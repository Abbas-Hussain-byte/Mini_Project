# Audit script for kaggle_archive labels
$root = "c:\Users\Awes\Desktop\ABBAS_DOCS\Mini_Project\kaggle_archive"

Write-Host "=============================="
Write-Host "DEAD ANIMALS POLLUTION - LABELS AUDIT"
Write-Host "=============================="

$deadLabelsDir = "$root\DeadAnimalsPollution\DeadAnimalsPollution\train\labels"
$deadImagesDir = "$root\DeadAnimalsPollution\DeadAnimalsPollution\train\images"

# Count totals
$totalImages = (Get-ChildItem $deadImagesDir -File).Count
$totalLabels = (Get-ChildItem $deadLabelsDir -File).Count
Write-Host "Total images: $totalImages"
Write-Host "Total labels: $totalLabels"

# Check istock labels
Write-Host "`n--- istock label contents ---"
Get-ChildItem $deadLabelsDir -Filter "istock*" | ForEach-Object {
    Write-Host "$($_.Name): $(Get-Content $_.FullName)"
}

# Check custom_real labels (first 20)
Write-Host "`n--- custom_real label contents (first 20) ---"
$customLabels = Get-ChildItem $deadLabelsDir -Filter "custom_real*" | Select-Object -First 20
foreach ($label in $customLabels) {
    Write-Host "$($label.Name): $(Get-Content $label.FullName)"
}

# Count custom_real images with labels vs without
$customImages = Get-ChildItem $deadImagesDir -Filter "custom_real*"
$customLabelsAll = Get-ChildItem $deadLabelsDir -Filter "custom_real*"
Write-Host "`nCustom real images: $($customImages.Count)"
Write-Host "Custom real labels: $($customLabelsAll.Count)"

# Check for fallback labels (0 0.5 0.5 0.9 0.9)
$fallbackCount = 0
$properCount = 0
foreach ($label in $customLabelsAll) {
    $content = Get-Content $label.FullName -Raw
    if ($content -match "0 0\.5 0\.5 0\.9 0\.9") {
        $fallbackCount++
    } else {
        $properCount++
    }
}
Write-Host "Labels with FALLBACK generic box (0 0.5 0.5 0.9 0.9): $fallbackCount"
Write-Host "Labels with PROPER bounding box: $properCount"

# Check for duplicate images (same file size)
Write-Host "`n--- Checking for duplicate images by file size ---"
$allCustomImages = Get-ChildItem $deadImagesDir -Filter "custom_real*"
$sizeGroups = $allCustomImages | Group-Object Length | Where-Object { $_.Count -gt 1 }
if ($sizeGroups) {
    Write-Host "DUPLICATES FOUND (same file size):"
    foreach ($group in $sizeGroups) {
        Write-Host "  Size $($group.Name) bytes: $($group.Count) files"
        foreach ($file in $group.Group) {
            Write-Host "    - $($file.Name)"
        }
    }
} else {
    Write-Host "No exact-size duplicates found"
}

# Check original Roboflow labels for comparison
Write-Host "`n--- Sample original Roboflow label contents (first 5) ---"
$origLabels = Get-ChildItem $deadLabelsDir -Filter "Dead-Animals*" | Select-Object -First 5
foreach ($label in $origLabels) {
    Write-Host "$($label.Name): $(Get-Content $label.FullName)"
}

Write-Host "`n=============================="
Write-Host "DAMAGED ELECTRICAL POLES - LABELS AUDIT"
Write-Host "=============================="

$elecLabelsDir = "$root\DamagedElectricalPoles\DamagedElectricalPoles\train\labels"
$elecImagesDir = "$root\DamagedElectricalPoles\DamagedElectricalPoles\train\images"

$totalImages2 = (Get-ChildItem $elecImagesDir -File).Count
$totalLabels2 = (Get-ChildItem $elecLabelsDir -File).Count
Write-Host "Total images: $totalImages2"
Write-Host "Total labels: $totalLabels2"

# Check custom_real labels
Write-Host "`n--- custom_real label contents (first 20) ---"
$customLabels2 = Get-ChildItem $elecLabelsDir -Filter "custom_real*" | Select-Object -First 20
foreach ($label in $customLabels2) {
    Write-Host "$($label.Name): $(Get-Content $label.FullName)"
}

$customImages2 = Get-ChildItem $elecImagesDir -Filter "custom_real*"
$customLabelsAll2 = Get-ChildItem $elecLabelsDir -Filter "custom_real*"
Write-Host "`nCustom real images: $($customImages2.Count)"
Write-Host "Custom real labels: $($customLabelsAll2.Count)"

$fallbackCount2 = 0
$properCount2 = 0
foreach ($label in $customLabelsAll2) {
    $content = Get-Content $label.FullName -Raw
    if ($content -match "0 0\.5 0\.5 0\.9 0\.9") {
        $fallbackCount2++
    } else {
        $properCount2++
    }
}
Write-Host "Labels with FALLBACK generic box: $fallbackCount2"
Write-Host "Labels with PROPER bounding box: $properCount2"

# Check for duplicate images
Write-Host "`n--- Checking for duplicate custom images by file size ---"
$allCustomImages2 = Get-ChildItem $elecImagesDir -Filter "custom_real*"
$sizeGroups2 = $allCustomImages2 | Group-Object Length | Where-Object { $_.Count -gt 1 }
if ($sizeGroups2) {
    Write-Host "DUPLICATES FOUND (same file size):"
    foreach ($group in $sizeGroups2) {
        Write-Host "  Size $($group.Name) bytes: $($group.Count) files"
        foreach ($file in $group.Group) {
            Write-Host "    - $($file.Name)"
        }
    }
} else {
    Write-Host "No exact-size duplicates found"
}

# Check original labels
Write-Host "`n--- Sample original Roboflow label contents (first 5) ---"
$origLabels2 = Get-ChildItem $elecLabelsDir -Exclude "custom_real*" | Select-Object -First 5
foreach ($label in $origLabels2) {
    Write-Host "$($label.Name): $(Get-Content $label.FullName)"
}

# Also check if the class IDs in custom labels match what's expected
Write-Host "`n=============================="
Write-Host "CLASS ID ANALYSIS"
Write-Host "=============================="
Write-Host "Expected class IDs per config.yaml:"
Write-Host "  7 = Dead Animal Pollution"
Write-Host "  9 = Damaged Electric wires and poles"
Write-Host ""
Write-Host "Checking what class IDs are actually used in custom labels..."

# DeadAnimals custom labels class IDs
Write-Host "`n--- DeadAnimalsPollution custom label class IDs ---"
$classIds = @{}
foreach ($label in (Get-ChildItem $deadLabelsDir -Filter "custom_real*")) {
    $lines = Get-Content $label.FullName
    foreach ($line in $lines) {
        if ($line.Trim()) {
            $classId = $line.Trim().Split(" ")[0]
            if (-not $classIds.ContainsKey($classId)) { $classIds[$classId] = 0 }
            $classIds[$classId]++
        }
    }
}
foreach ($key in $classIds.Keys) {
    Write-Host "  Class $key : $($classIds[$key]) annotations"
}

# istock labels class IDs
Write-Host "`n--- DeadAnimalsPollution istock label class IDs ---"
$classIds2 = @{}
foreach ($label in (Get-ChildItem $deadLabelsDir -Filter "istock*")) {
    $lines = Get-Content $label.FullName
    foreach ($line in $lines) {
        if ($line.Trim()) {
            $classId = $line.Trim().Split(" ")[0]
            if (-not $classIds2.ContainsKey($classId)) { $classIds2[$classId] = 0 }
            $classIds2[$classId]++
        }
    }
}
foreach ($key in $classIds2.Keys) {
    Write-Host "  Class $key : $($classIds2[$key]) annotations"
}

# Electrical custom labels class IDs
Write-Host "`n--- DamagedElectricalPoles custom label class IDs ---"
$classIds3 = @{}
foreach ($label in (Get-ChildItem $elecLabelsDir -Filter "custom_real*")) {
    $lines = Get-Content $label.FullName
    foreach ($line in $lines) {
        if ($line.Trim()) {
            $classId = $line.Trim().Split(" ")[0]
            if (-not $classIds3.ContainsKey($classId)) { $classIds3[$classId] = 0 }
            $classIds3[$classId]++
        }
    }
}
foreach ($key in $classIds3.Keys) {
    Write-Host "  Class $key : $($classIds3[$key]) annotations"
}

# Also check original labels class IDs
Write-Host "`n--- DeadAnimalsPollution original Roboflow label class IDs (sample 20) ---"
$classIds4 = @{}
foreach ($label in (Get-ChildItem $deadLabelsDir -Filter "Dead-Animals*" | Select-Object -First 20)) {
    $lines = Get-Content $label.FullName
    foreach ($line in $lines) {
        if ($line.Trim()) {
            $classId = $line.Trim().Split(" ")[0]
            if (-not $classIds4.ContainsKey($classId)) { $classIds4[$classId] = 0 }
            $classIds4[$classId]++
        }
    }
}
foreach ($key in $classIds4.Keys) {
    Write-Host "  Class $key : $($classIds4[$key]) annotations"
}

Write-Host "`n--- DamagedElectricalPoles original Roboflow label class IDs (sample 20) ---"
$classIds5 = @{}
$origElec = Get-ChildItem $elecLabelsDir -Exclude "custom_real*" | Select-Object -First 20
foreach ($label in $origElec) {
    $lines = Get-Content $label.FullName
    foreach ($line in $lines) {
        if ($line.Trim()) {
            $classId = $line.Trim().Split(" ")[0]
            if (-not $classIds5.ContainsKey($classId)) { $classIds5[$classId] = 0 }
            $classIds5[$classId]++
        }
    }
}
foreach ($key in $classIds5.Keys) {
    Write-Host "  Class $key : $($classIds5[$key]) annotations"
}
