"""
CivicPulse — BERT Fine-Tuning Training Script
Fine-tunes bert-base-uncased on civic complaint categories
using the Kaggle Urban Issues Dataset text annotations.

Usage:
    python train_bert.py --data_path ./data/complaints.csv --epochs 5 --batch_size 16

Dataset format (CSV):
    text,category
    "There is a pothole on MG Road near bus stop",pothole
    "Garbage piling up at sector 12 junction",littering
"""

import os
import argparse
import json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    BertTokenizer,
    BertForSequenceClassification,
    AdamW,
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


def generate_synthetic_data():
    """Generate synthetic training data for civic complaints"""
    templates = {
        'damaged_road': [
            "The road surface is badly damaged near {loc}",
            "Road has cracks and broken asphalt at {loc}",
            "Damaged road causing vehicle damage near {loc}",
            "Road surface broken and needs repair at {loc}",
        ],
        'pothole': [
            "Large pothole on {loc} road causing accidents",
            "Deep pothole near {loc} junction needs immediate fix",
            "Multiple potholes spotted on {loc} highway",
            "Dangerous pothole filled with water at {loc}",
        ],
        'littering': [
            "Garbage piling up at {loc} junction",
            "Waste not collected for days near {loc}",
            "Littering and garbage overflow at {loc}",
            "Trash dumped illegally near {loc} residential area",
        ],
        'water_supply': [
            "No water supply for 3 days at {loc}",
            "Water pipe burst near {loc} colony",
            "Low water pressure in {loc} area",
            "Contaminated water supply at {loc}",
        ],
        'drainage': [
            "Storm drain blocked at {loc} causing flooding",
            "Drainage overflow near {loc} market area",
            "Open drain is a health hazard at {loc}",
            "Drain cover missing near {loc} school",
        ],
        'electricity': [
            "Power outage since 2 days at {loc}",
            "Street light not working near {loc}",
            "Electrical pole damaged in {loc} area",
            "Frequent power cuts in {loc} neighborhood",
        ],
        'fallen_trees': [
            "Fallen tree blocking road at {loc}",
            "Tree fell on car during storm at {loc}",
            "Uprooted tree near {loc} park",
            "Dangerous leaning tree at {loc} may fall",
        ],
        'illegal_parking': [
            "Vehicles illegally parked on footpath at {loc}",
            "Double parking blocking traffic near {loc}",
            "Unauthorized parking in no-parking zone at {loc}",
            "Abandoned vehicle on road at {loc}",
        ],
        'vandalism': [
            "Public property vandalized near {loc}",
            "Graffiti on government building at {loc}",
            "Bus stop shelter destroyed at {loc}",
            "Park bench broken by vandals at {loc}",
        ],
        'damaged_concrete': [
            "Concrete sidewalk crumbling at {loc}",
            "Bridge concrete deteriorating near {loc}",
            "Concrete barrier damaged at {loc} flyover",
            "Building wall concrete falling on pedestrians near {loc}",
        ],
        'broken_road_sign': [
            "Traffic sign knocked down at {loc} intersection",
            "Road sign not visible due to damage at {loc}",
            "Stop sign missing at {loc} crossing",
            "Speed limit sign broken near {loc} school zone",
        ],
        'dead_animal': [
            "Dead animal on road near {loc}",
            "Animal carcass not removed for days at {loc}",
            "Dead dog on the highway near {loc}",
            "Dead cow blocking traffic at {loc}",
        ],
        'damaged_electric_wires': [
            "Exposed electric wires hanging low at {loc}",
            "Damaged power line touching tree at {loc}",
            "Electrical cable on the ground at {loc}",
            "Sparking electric wire near {loc} market",
        ],
        'sewage': [
            "Sewage water overflowing on road at {loc}",
            "Manhole cover broken and sewage leaking at {loc}",
            "Sewage smell unbearable near {loc}",
            "Raw sewage in residential area {loc}",
        ],
        'other': [
            "Noise pollution from construction at {loc}",
            "Stray animal menace in {loc} area",
            "Public toilet not maintained at {loc}",
            "Footpath encroachment near {loc}",
        ],
    }

    locations = [
        "MG Road", "Sector 12", "Gandhi Nagar", "Station Road",
        "Ring Road", "Market Area", "Highway 44", "Civil Lines",
        "Main Street", "Park Avenue", "Lake View Colony", "Industrial Area",
        "Bus Stand", "Railway Crossing", "College Road", "Hospital Road",
    ]

    texts, labels = [], []
    for category, tmpls in templates.items():
        for tmpl in tmpls:
            for loc in locations:
                text = tmpl.format(loc=loc)
                texts.append(text)
                labels.append(CATEGORY_TO_ID[category])

    return texts, labels


# ============================================================
# Training
# ============================================================

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🔧 Device: {device}")

    # Load tokenizer
    print("📦 Loading BERT tokenizer...")
    tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')

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
        print("📊 Generating synthetic training data...")
        texts, labels = generate_synthetic_data()
        print(f"📊 Generated {len(texts)} synthetic samples")

    # Split data
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )
    print(f"📊 Train: {len(train_texts)} | Val: {len(val_texts)}")

    # Create datasets
    train_dataset = ComplaintDataset(train_texts, train_labels, tokenizer)
    val_dataset = ComplaintDataset(val_texts, val_labels, tokenizer)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size)

    # Load model
    print("📦 Loading BERT model...")
    model = BertForSequenceClassification.from_pretrained(
        'bert-base-uncased',
        num_labels=len(CATEGORIES)
    ).to(device)

    # Optimizer and scheduler
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total_steps = len(train_loader) * args.epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=total_steps // 10, num_training_steps=total_steps
    )

    # Training loop
    best_accuracy = 0
    for epoch in range(args.epochs):
        model.train()
        total_loss = 0

        for batch in train_loader:
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
            save_path = os.path.join(args.output_dir, 'best_model')
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
    with open(os.path.join(args.output_dir, 'label_map.json'), 'w') as f:
        json.dump({'id_to_category': ID_TO_CATEGORY, 'category_to_id': CATEGORY_TO_ID}, f, indent=2)

    print(f"\n✅ Training complete! Best accuracy: {best_accuracy:.4f}")
    print(f"📁 Model saved to: {args.output_dir}/best_model/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train BERT for civic complaint classification')
    parser.add_argument('--data_path', type=str, default=None, help='Path to CSV training data')
    parser.add_argument('--output_dir', type=str, default='./models/bert-civic', help='Model output directory')
    parser.add_argument('--epochs', type=int, default=5, help='Number of training epochs')
    parser.add_argument('--batch_size', type=int, default=16, help='Batch size')
    parser.add_argument('--lr', type=float, default=2e-5, help='Learning rate')

    args = parser.parse_args()
    train(args)
