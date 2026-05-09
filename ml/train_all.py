"""
CivicPulse — Master Training Script
Runs both YOLO and BERT training sequentially.

Usage:
    python train_all.py                     # Train both models
    python train_all.py --skip-yolo         # Only train BERT
    python train_all.py --skip-bert         # Only train YOLO
    python train_all.py --dry-run           # Prepare data only, no training
"""

import subprocess
import sys
import os
import time
import argparse
 
ML_DIR = os.path.dirname(os.path.abspath(__file__))


def run_script(name, cmd, cwd):
    """Run a training script and stream its output."""
    print(f"\n{'=' * 60}")
    print(f"  {name}")
    print(f"{'=' * 60}\n")
    
    start = time.time()
    
    result = subprocess.run(
        cmd,
        cwd=cwd,
        shell=True,
    )
    
    elapsed = time.time() - start
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)
    
    if result.returncode == 0:
        print(f"\n✅ {name} completed in {minutes}m {seconds}s")
    else:
        print(f"\n❌ {name} FAILED (exit code: {result.returncode})")
    
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description='Train all CivicPulse ML models')
    parser.add_argument('--skip-yolo', action='store_true', help='Skip YOLO training')
    parser.add_argument('--skip-bert', action='store_true', help='Skip BERT training')
    parser.add_argument('--dry-run', action='store_true', help='Only prepare data, no training')
    parser.add_argument('--yolo-epochs', type=int, default=30, help='YOLO epochs (default: 30)')
    parser.add_argument('--bert-epochs', type=int, default=5, help='BERT epochs (default: 5)')
    parser.add_argument('--device', type=str, default='cpu', help='Device: cpu or 0 for GPU')
    parser.add_argument('--max-per-class', type=int, default=50000, help='Max images per class (default: 50000 = ALL). Ignored if --balance is used.')
    parser.add_argument('--balance', action='store_true', default=True, help='Use balanced dataset (recommended, fixes class imbalance)')
    parser.add_argument('--no-balance', action='store_true', help='Skip balancing, use raw dataset')
    args = parser.parse_args()

    print("""
╔══════════════════════════════════════════╗
║   CivicPulse ML Training Pipeline        ║
║   Training YOLO + BERT models            ║
╚══════════════════════════════════════════╝
    """)

    python = sys.executable
    overall_start = time.time()
    results = {}

    # 0. Balance dataset (if not skipping)
    if not args.skip_yolo and args.balance and not args.no_balance:
        balance_cmd = f'"{python}" balance_dataset.py'
        if args.dry_run:
            balance_cmd += ' --dry-run'
        results['Balance'] = run_script('Dataset Balancing', balance_cmd, ML_DIR)
        if not results.get('Balance', True):
            print("\n  Dataset balancing failed. Aborting.")
            sys.exit(1)

    # 1. Train YOLO
    if not args.skip_yolo:
        dry_flag = ' --dry-run' if args.dry_run else ''
        # When balanced, skip the internal prepare_dataset (data is already in prepared/)
        yolo_cmd = f'"{python}" train_yolo.py --epochs {args.yolo_epochs} --device {args.device} --max_per_class {args.max_per_class}{dry_flag}'
        results['YOLO'] = run_script('YOLO Training', yolo_cmd, ML_DIR)
    else:
        print("\n⏭️  Skipping YOLO training")

    # 2. Train BERT
    if not args.skip_bert:
        dry_flag = ' --dry-run' if args.dry_run else ''
        bert_cmd = f'"{python}" train_bert.py --epochs {args.bert_epochs}{dry_flag}'
        results['BERT'] = run_script('BERT Training', bert_cmd, ML_DIR)
    else:
        print("\n⏭️  Skipping BERT training")

    # Summary
    total_elapsed = time.time() - overall_start
    total_min = int(total_elapsed // 60)
    total_sec = int(total_elapsed % 60)

    print(f"\n{'=' * 60}")
    print(f"  TRAINING SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Total time: {total_min}m {total_sec}s")
    for name, success in results.items():
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"  {name}: {status}")
    print()

    if all(results.values()):
        print("🎉 All training complete!")
        if not args.dry_run:
            print("   Restart the ML service (python app.py) to use the new models.")
    else:
        print("⚠️  Some training steps failed. Check the output above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
