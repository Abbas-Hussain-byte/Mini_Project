"""
CivicPulse — BERT Fine-Tuning Training Script
Fine-tunes distilbert-base-uncased on civic complaint categories
using large-scale synthetic data with augmentation.

Usage:
    python train_bert.py                          # Train with synthetic data
    python train_bert.py --data_path data.csv     # Train with real CSV data
    python train_bert.py --epochs 3 --dry-run     # Quick test
"""

import os
import random
import argparse
import json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    DistilBertTokenizer,
    DistilBertForSequenceClassification,
    get_linear_schedule_with_warmup
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# ============================================================
# Configuration
# ============================================================

CATEGORIES = [
    'damaged_road', 'pothole', 'littering', 'water_supply',
    'drainage', 'electricity', 'fallen_trees', 'illegal_parking',
    'vandalism', 'damaged_concrete', 'broken_road_sign',
    'dead_animal', 'damaged_electric_wires', 'sewage', 'other'
]

CATEGORY_TO_ID = {cat: i for i, cat in enumerate(CATEGORIES)}
ID_TO_CATEGORY = {i: cat for i, cat in enumerate(CATEGORIES)}

ML_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# Dataset
# ============================================================

class ComplaintDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            self.texts[idx],
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        return {
            'input_ids': encoding['input_ids'].squeeze(),
            'attention_mask': encoding['attention_mask'].squeeze(),
            'labels': torch.tensor(self.labels[idx], dtype=torch.long)
        }


# ============================================================
# Augmentation helpers
# ============================================================

def random_word_swap(text, n_swaps=1):
    """Randomly swap adjacent words."""
    words = text.split()
    if len(words) < 3:
        return text
    for _ in range(n_swaps):
        idx = random.randint(0, len(words) - 2)
        words[idx], words[idx + 1] = words[idx + 1], words[idx]
    return ' '.join(words)


def random_word_drop(text, drop_prob=0.1):
    """Randomly drop words with given probability."""
    words = text.split()
    if len(words) <= 3:
        return text
    kept = [w for w in words if random.random() > drop_prob]
    return ' '.join(kept) if kept else text


def inject_typo(text, prob=0.05):
    """Inject random typos to simulate real user input."""
    chars = list(text)
    for i in range(len(chars)):
        if random.random() < prob and chars[i].isalpha():
            chars[i] = random.choice('abcdefghijklmnopqrstuvwxyz')
    return ''.join(chars)


def augment_text(text):
    """Apply random augmentation to a text sample."""
    r = random.random()
    if r < 0.3:
        return random_word_swap(text)
    elif r < 0.5:
        return random_word_drop(text)
    elif r < 0.65:
        return inject_typo(text)
    elif r < 0.8:
        return text.lower()  # Case variation
    else:
        return text  # Original


def generate_synthetic_data():
    """Generate large-scale synthetic training data for civic complaints."""
    templates = {
        'damaged_road': [
            "The road surface is badly damaged near {loc}",
            "Road has deep cracks and broken asphalt at {loc}",
            "Damaged road causing vehicle damage near {loc}",
            "Road surface broken and needs urgent repair at {loc}",
            "The main road near {loc} is completely destroyed",
            "Uneven road surface dangerous for bikers at {loc}",
            "Road deteriorated badly after rains near {loc}",
            "Broken road near {loc} causing frequent accidents",
            "The road at {loc} has huge cracks everywhere",
            "Road is in terrible condition near {loc} market",
            "road damage reported at {loc} area needs attention",
            "Badly damaged road at {loc} intersection is very dangerous",
            "the road surface near {loc} school is completely broken",
            "multiple cracks on road at {loc} bus stand area",
            "damaged asphalt road causing problems near {loc}",
        ],
        'pothole': [
            "Large pothole on {loc} road causing accidents",
            "Deep pothole near {loc} junction needs immediate fix",
            "Multiple potholes spotted on {loc} highway",
            "Dangerous pothole filled with water at {loc}",
            "Giant pothole on the main road at {loc}",
            "Pothole caused my bike to skid near {loc}",
            "Water-filled potholes everywhere at {loc}",
            "There is a big pothole near {loc} bus stop",
            "Potholes making driving dangerous at {loc}",
            "Small potholes turning into craters at {loc}",
            "huge pothole near {loc} causing traffic jams daily",
            "dangerous pothole in front of {loc} apartment complex",
            "deep pothole at {loc} filled with mud water",
            "the road at {loc} has so many potholes its undrivable",
            "pothole near {loc} market area needs immediate repair",
        ],
        'littering': [
            "Garbage piling up at {loc} junction for weeks",
            "Waste not collected for days near {loc}",
            "Littering and garbage overflow at {loc}",
            "Trash dumped illegally near {loc} residential area",
            "Huge garbage pile near {loc} school causing health issues",
            "Waste overflowing from bins at {loc}",
            "People dumping waste on the roadside at {loc}",
            "Uncollected garbage attracting stray dogs at {loc}",
            "Litter scattered all over {loc} park",
            "Garbage bins not emptied for a week at {loc}",
            "garbage everywhere near {loc} market area stinks horribly",
            "trash piled up near {loc} causing disease spread",
            "waste dumping near {loc} riverbank polluting water",
            "garbage collection not happening at {loc} colony since days",
            "rubbish and debris scattered across {loc} main road",
            "overflowing dustbins near {loc} creating awful smell",
        ],
        'water_supply': [
            "No water supply for 3 days at {loc}",
            "Water pipe burst near {loc} colony",
            "Low water pressure in {loc} area",
            "Contaminated water supply at {loc}",
            "Drinking water not coming since morning at {loc}",
            "Main water line broken at {loc}",
            "Dirty water coming from taps at {loc}",
            "Water shortage affecting hundreds at {loc}",
            "water supply completely stopped at {loc} area",
            "rusty brown water coming from tap at {loc}",
            "water pressure is very low in {loc} neighborhood",
            "pipe leakage wasting water near {loc}",
            "no running water at {loc} since last 2 days",
            "water pipeline burst near {loc} causing flooding",
            "contaminated water making people sick at {loc}",
        ],
        'drainage': [
            "Storm drain blocked at {loc} causing flooding",
            "Drainage overflow near {loc} market area",
            "Open drain is a health hazard at {loc}",
            "Drain cover missing near {loc} school",
            "Rainwater flooding roads due to blocked drains at {loc}",
            "Open drainage releasing bad smell at {loc}",
            "Drainage system completely clogged at {loc}",
            "Stagnant water in drains breeding mosquitoes at {loc}",
            "drain overflow causing waterlogging near {loc}",
            "blocked drainage at {loc} causing water to enter houses",
            "open drain near {loc} playground is a major hazard",
            "drainage pipe broken at {loc} leaking waste water",
            "water not draining after rain at {loc} main road",
            "gutter overflow spreading filth near {loc}",
        ],
        'electricity': [
            "Power outage since 2 days at {loc}",
            "Street light not working near {loc} for a month",
            "Electrical pole damaged in {loc} area",
            "Frequent power cuts in {loc} neighborhood",
            "Transformer burst near {loc} causing blackout",
            "No electricity supply at {loc} since last night",
            "Streetlights broken along entire {loc} road",
            "Power fluctuation damaging appliances at {loc}",
            "electricity failure at {loc} area since 3 days",
            "street light pole fallen near {loc} very dangerous",
            "power transformer making loud noise at {loc}",
            "no street lights on {loc} highway very unsafe at night",
            "electricity keeps going off every hour at {loc}",
            "broken street light near {loc} school zone",
        ],
        'fallen_trees': [
            "Fallen tree blocking road at {loc}",
            "Tree fell on car during storm at {loc}",
            "Uprooted tree near {loc} park blocking entrance",
            "Dangerous leaning tree at {loc} may fall anytime",
            "Large tree branch fell on footpath at {loc}",
            "Tree fell after heavy wind at {loc} intersection",
            "Broken tree blocking walkway at {loc}",
            "Old tree about to fall on road at {loc}",
            "big tree fell across road at {loc} blocking all traffic",
            "fallen tree branches covering road at {loc}",
            "tree uprooted after storm at {loc} nearly hit a person",
            "dead tree leaning dangerously at {loc} needs removal",
            "large branch broke off tree at {loc} blocking lane",
            "tree fell on power line near {loc} very dangerous",
        ],
        'illegal_parking': [
            "Vehicles illegally parked on footpath at {loc}",
            "Double parking blocking traffic near {loc}",
            "Unauthorized parking in no-parking zone at {loc}",
            "Abandoned vehicle on road at {loc} for weeks",
            "Cars parked on pedestrian crossing at {loc}",
            "Truck illegally parked blocking lane at {loc}",
            "Bikes parked on sidewalk at {loc} blocking way",
            "No-parking zone completely taken over at {loc}",
            "cars parked illegally near {loc} fire hydrant",
            "vehicles blocking driveway at {loc} every day",
            "unauthorized parking in front of {loc} hospital entrance",
            "double parked cars causing chaos near {loc} market",
            "illegally parked trucks blocking entire road at {loc}",
            "parking on footpath near {loc} forcing pedestrians on road",
        ],
        'vandalism': [
            "Public property vandalized near {loc}",
            "Graffiti on government building at {loc}",
            "Bus stop shelter destroyed at {loc}",
            "Park bench broken by vandals at {loc}",
            "Street signs defaced near {loc}",
            "Public toilet vandalized at {loc}",
            "Wall paintings and graffiti everywhere at {loc}",
            "Public phone booth smashed near {loc}",
            "vandals destroyed playground equipment at {loc} park",
            "graffiti sprayed on walls near {loc} monument",
            "public property damaged by miscreants at {loc}",
            "bus stop glass smashed by vandals at {loc}",
            "garden fencing broken and vandalized at {loc}",
            "public notice board destroyed near {loc}",
        ],
        'damaged_concrete': [
            "Concrete sidewalk crumbling at {loc}",
            "Bridge concrete deteriorating near {loc}",
            "Concrete barrier damaged at {loc} flyover",
            "Building wall concrete falling on pedestrians near {loc}",
            "Cracked concrete on footpath at {loc} very dangerous",
            "Concrete pillars showing rust damage at {loc} bridge",
            "Footpath concrete broken and uneven at {loc}",
            "Overpass concrete chunks falling at {loc}",
            "damaged concrete wall near {loc} about to collapse",
            "crumbling concrete structure at {loc} bus shelter",
            "concrete chunks falling from overpass at {loc}",
            "deteriorating concrete pillar near {loc} highway",
            "broken concrete pavement at {loc} tripping hazard",
            "old concrete building facade crumbling at {loc}",
        ],
        'broken_road_sign': [
            "Traffic sign knocked down at {loc} intersection",
            "Road sign not visible due to damage at {loc}",
            "Stop sign missing at {loc} crossing",
            "Speed limit sign broken near {loc} school zone",
            "Direction board damaged near {loc} highway exit",
            "No entry sign completely faded at {loc}",
            "Road sign bent and unreadable at {loc}",
            "Warning sign missing at sharp curve near {loc}",
            "traffic signal broken at {loc} causing confusion",
            "road sign knocked over at {loc} junction",
            "missing stop sign at {loc} crossroad very dangerous",
            "speed limit board damaged near {loc} playground area",
            "sign post bent after accident at {loc}",
            "road markings faded and sign missing at {loc}",
        ],
        'dead_animal': [
            "Dead animal on road near {loc}",
            "Animal carcass not removed for days at {loc}",
            "Dead dog on the highway near {loc}",
            "Dead cow blocking traffic at {loc}",
            "Rotting animal carcass causing bad smell at {loc}",
            "Dead bird near {loc} park entrance",
            "Hit and run dead animal on {loc} road",
            "Dead stray animal near residential area {loc}",
            "dead animal decomposing on roadside at {loc}",
            "carcass on road near {loc} attracting vultures",
            "dead cow lying on highway at {loc} for two days",
            "animal carcass near {loc} school spreading disease",
            "dead dog body near {loc} market area not cleaned",
            "roadkill near {loc} needs immediate cleanup",
        ],
        'damaged_electric_wires': [
            "Exposed electric wires hanging low at {loc}",
            "Damaged power line touching tree at {loc}",
            "Electrical cable on the ground at {loc}",
            "Sparking electric wire near {loc} market",
            "Low-hanging power cable dangerous at {loc}",
            "Electric pole leaning after storm at {loc}",
            "Broken wire from transformer at {loc}",
            "Live wire on sidewalk at {loc} extremely dangerous",
            "damaged electric wire sparking near {loc} playground",
            "exposed cable hanging at {loc} bus stop",
            "power line dangling low at {loc} very risky",
            "electric wire fell on road at {loc} after storm",
            "broken power cable near {loc} leaking electricity",
            "damaged electrical pole tilting dangerously at {loc}",
        ],
        'sewage': [
            "Sewage water overflowing on road at {loc}",
            "Manhole cover broken and sewage leaking at {loc}",
            "Sewage smell unbearable near {loc}",
            "Raw sewage in residential area {loc}",
            "Sewage pipeline burst flooding street at {loc}",
            "Open sewer line running through {loc} area",
            "Sewage backing up into homes at {loc}",
            "Broken manhole spewing sewage at {loc}",
            "sewage overflow flooding road near {loc}",
            "raw sewage water leaking near {loc} school",
            "manhole broken and sewage spilling at {loc}",
            "awful sewage smell in {loc} neighborhood",
            "sewer pipe burst near {loc} causing health hazard",
            "wastewater flowing openly near {loc} park",
        ],
        'other': [
            "Noise pollution from construction at {loc}",
            "Stray animal menace in {loc} area",
            "Public toilet not maintained at {loc}",
            "Footpath encroachment near {loc}",
            "Illegal construction activity at {loc}",
            "Unauthorized hawkers blocking road at {loc}",
            "Air pollution from factory near {loc}",
            "Mosquito breeding in stagnant water at {loc}",
            "fire safety issue at {loc} building complex",
            "illegal dumping of construction waste at {loc}",
            "noise from loudspeaker at {loc} during night",
            "stray dogs aggressive in {loc} colony",
            "public bench broken at {loc} park",
            "unauthorized construction at {loc} blocking traffic",
        ],
    }

    locations = [
        "MG Road", "Sector 12", "Gandhi Nagar", "Station Road",
        "Ring Road", "Market Area", "Highway 44", "Civil Lines",
        "Main Street", "Park Avenue", "Lake View Colony", "Industrial Area",
        "Bus Stand", "Railway Crossing", "College Road", "Hospital Road",
        "Temple Street", "New Colony", "Old City", "Airport Road",
        "Bridge Point", "Mall Road", "University Campus", "IT Park",
        "Phase 2", "Block C", "Ward 7", "Nehru Nagar",
        "Rajiv Chowk", "Ashoka Marg", "JP Nagar", "Indira Colony",
    ]

    texts, labels = [], []
    for category, tmpls in templates.items():
        for tmpl in tmpls:
            for loc in locations:
                text = tmpl.format(loc=loc)
                texts.append(text)
                labels.append(CATEGORY_TO_ID[category])
                
                # Add augmented variants
                for _ in range(2):
                    augmented = augment_text(text)
                    if augmented != text:
                        texts.append(augmented)
                        labels.append(CATEGORY_TO_ID[category])

    return texts, labels


# ============================================================
# Training
# ============================================================

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\n🔧 Device: {device}")

    # Load tokenizer
    print("📦 Loading DistilBERT tokenizer...")
    tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')

    # Load or generate data
    if args.data_path and os.path.exists(args.data_path):
        import csv
        texts, labels = [], []
        with open(args.data_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                texts.append(row['text'])
                labels.append(CATEGORY_TO_ID.get(row['category'], CATEGORY_TO_ID['other']))
        print(f"📊 Loaded {len(texts)} samples from {args.data_path}")
    else:
        print("📊 Generating synthetic training data (with augmentation)...")
        texts, labels = generate_synthetic_data()
        print(f"📊 Generated {len(texts)} samples ({len(CATEGORIES)} categories)")

    if args.dry_run:
        print("\n🏁 Dry-run complete.")
        print(f"   Total samples: {len(texts)}")
        for cat in CATEGORIES:
            count = labels.count(CATEGORY_TO_ID[cat])
            print(f"   {cat}: {count} samples")
        return

    # Split data
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=0.15, random_state=42, stratify=labels
    )
    print(f"📊 Train: {len(train_texts)} | Val: {len(val_texts)}")

    # Create datasets
    train_dataset = ComplaintDataset(train_texts, train_labels, tokenizer)
    val_dataset = ComplaintDataset(val_texts, val_labels, tokenizer)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size)

    # Load model — using DistilBERT (2x smaller, 60% faster than BERT)
    print("📦 Loading DistilBERT model...")
    model = DistilBertForSequenceClassification.from_pretrained(
        'distilbert-base-uncased',
        num_labels=len(CATEGORIES)
    ).to(device)

    # Optimizer and scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_loader) * args.epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=total_steps // 10, num_training_steps=total_steps
    )

    # Training loop
    best_accuracy = 0
    output_dir = os.path.join(ML_DIR, args.output_dir) if not os.path.isabs(args.output_dir) else args.output_dir
    
    print(f"\n🚀 Starting training ({args.epochs} epochs)...\n")
    
    for epoch in range(args.epochs):
        model.train()
        total_loss = 0

        for batch_idx, batch in enumerate(train_loader):
            optimizer.zero_grad()
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels_batch = batch['labels'].to(device)

            outputs = model(input_ids, attention_mask=attention_mask, labels=labels_batch)
            loss = outputs.loss
            total_loss += loss.item()

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()

            if (batch_idx + 1) % 50 == 0:
                print(f"   Epoch {epoch+1} | Batch {batch_idx+1}/{len(train_loader)} | Loss: {loss.item():.4f}")

        avg_loss = total_loss / len(train_loader)

        # Validation
        model.eval()
        all_preds, all_labels = [], []
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels_batch = batch['labels'].to(device)

                outputs = model(input_ids, attention_mask=attention_mask)
                preds = torch.argmax(outputs.logits, dim=1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels_batch.cpu().numpy())

        accuracy = accuracy_score(all_labels, all_preds)
        print(f"📈 Epoch {epoch+1}/{args.epochs} | Loss: {avg_loss:.4f} | Val Acc: {accuracy:.4f}")

        if accuracy > best_accuracy:
            best_accuracy = accuracy
            save_path = os.path.join(output_dir, 'best_model')
            os.makedirs(save_path, exist_ok=True)
            model.save_pretrained(save_path)
            tokenizer.save_pretrained(save_path)
            print(f"💾 Best model saved (accuracy: {accuracy:.4f})")

    # Final classification report
    print("\n📊 Classification Report:")
    print(classification_report(
        all_labels, all_preds,
        target_names=CATEGORIES,
        zero_division=0
    ))

    # Save label mapping
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, 'label_map.json'), 'w') as f:
        json.dump({'id_to_category': ID_TO_CATEGORY, 'category_to_id': CATEGORY_TO_ID}, f, indent=2)

    print(f"\n✅ Training complete! Best accuracy: {best_accuracy:.4f}")
    print(f"📁 Model saved to: {output_dir}/best_model/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train DistilBERT for civic complaint classification')
    parser.add_argument('--data_path', type=str, default=None, help='Path to CSV training data')
    parser.add_argument('--output_dir', type=str, default='models/bert-civic', help='Model output directory')
    parser.add_argument('--epochs', type=int, default=5, help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=16, help='Batch size')
    parser.add_argument('--lr', type=float, default=2e-5, help='Learning rate')
    parser.add_argument('--dry-run', action='store_true', help='Only generate data, skip training')

    args = parser.parse_args()
    train(args)
