// Default items database with image paths
const defaultItems = [
    { name: "ID Card", width: 85.6, height: 54, unit: "mm"},
    { name: "A4 Paper", width: 210, height: 297, unit: "mm", image: "src/a4.png" },
    { name: "US Letter", width: 215.9, height: 279.4, unit: "mm", image: "src/a4.png" },
    { name: "Tabloid/Ledger", width: 279.4, height: 431.8, unit: "mm", image: "src/a4.png" },
    { name: "MacBook Pro 14", width: 312.6, height: 221.2, unit: "mm", image: "src/macbook_pro.png" },
    { name: "AA Battery", width: 14.5, height: 50.5, unit: "mm", image: "src/aa_battery.png" },
    { name: "Wilson Tennis Ball", width: 6.54, height: 6.54, unit: "cm", image: "src/wilson.png" },
    { name: "USB Flash Drive", width: 12, height: 40, unit: "mm", image: "usb_drive.png" },
    { name: "Smartphone", width: 71, height: 146, unit: "mm", image: "smartphone.png" },
    { name: "Business Card", width: 90, height: 55, unit: "mm", image: "business_card.png" },
    { name: "Dollar Bill", width: 155.956, height: 66.294, unit: "mm", image: "src/dollar.jpg" },
    { name: "DVD Disc", width: 120, height: 120, unit: "mm", image: "dvd_disc.png" },
    { name: "Post-it Note", width: 76, height: 76, unit: "mm", image: "postit_note.png" },
    { name: "USA McDonald’s Medium Cup", width: 90, height: 160, unit: "mm", image: "src/coca_cola.png" },
    { name: "Japan McDonald’s Medium Cup", width: 85, height: 135, unit: "mm", image: "src/coca_cola.png" }
];

// Constants for unit conversion
const conversionToMm = {
    mm: 1,
    cm: 10,
    m: 1000,
    km: 1000000,
    inch: 25.4,
    ft: 304.8,
    yard: 914.4,
    mile: 1609344,
    pt: 0.352778,
    μm: 0.001
};

// Screen density detection (for Real Life Mode)
let pixelsPerMm = 3.78; // Default value (96 DPI)

// Current mode
let isRealLifeMode = false;

// Custom item image URL
let customItemImageUrl = null;

// DOM elements
const comparisonArea = document.getElementById('comparison-area');
const screenModeBtn = document.getElementById('screen-mode');
const realLifeModeBtn = document.getElementById('real-life-mode');
const addDefaultItemBtn = document.getElementById('add-default-item');
const dropdownMenu = document.getElementById('dropdown-menu');
const zoomIndicator = document.getElementById('zoom-indicator');
const calibrationSection = document.getElementById('calibration-section');
const calibrationSlider = document.getElementById('calibration-slider');
const saveCalibrationBtn = document.getElementById('save-calibration');

// Initialize the app
function initApp() {
    detectPixelDensity();
    populateDropdownMenu();
    setupImageUpload();
    
    // Set initial calibration slider value
    calibrationSlider.value = pixelsPerMm;
    
    // Add ID card as default reference item
    addItemToComparison(defaultItems[0]);

    // Add user's custom item (1cm x 1cm)
    const customItem = {
        name: "Your Item",
        width: 10,
        height: 10,
        unit: "cm",
        // image will be added via upload
    };
    addItemToComparison(customItem);
    
    // Set up event listeners
    screenModeBtn.addEventListener('click', () => setMode('screen'));
    realLifeModeBtn.addEventListener('click', () => setMode('real-life'));
    addDefaultItemBtn.addEventListener('click', toggleDropdown);
    
    document.getElementById('item-width').addEventListener('input', updateCustomItem);
    document.getElementById('item-height').addEventListener('input', updateCustomItem);
    document.getElementById('item-name').addEventListener('input', updateCustomItem);
    document.getElementById('item-unit').addEventListener('change', updateCustomItem);
    
    // Calibration controls
    calibrationSlider.addEventListener('input', () => {
        pixelsPerMm = parseFloat(calibrationSlider.value);
        if (isRealLifeMode) {
            updateAllItems();
        }
    });
    
    saveCalibrationBtn.addEventListener('click', () => {
        calibrationSection.style.display = 'none';
        localStorage.setItem('pixelsPerMm', pixelsPerMm);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.matches('#add-default-item') && !dropdownMenu.contains(e.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
    
    // Try to load saved calibration
    const savedCalibration = localStorage.getItem('pixelsPerMm');
    if (savedCalibration) {
        pixelsPerMm = parseFloat(savedCalibration);
        calibrationSlider.value = pixelsPerMm;
    }
}

// Try to detect the screen's pixel density
function detectPixelDensity() {
    try {
        const testDiv = document.createElement('div');
        testDiv.style.width = '1in';
        testDiv.style.height = '1in';
        testDiv.style.position = 'absolute';
        testDiv.style.left = '-100%';
        testDiv.style.top = '-100%';
        document.body.appendChild(testDiv);
        
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = testDiv.offsetWidth;
        
        document.body.removeChild(testDiv);
        
        // Calculate pixels per mm
        pixelsPerMm = (width * devicePixelRatio) / 25.4;
        console.log(`Detected pixels per mm: ${pixelsPerMm}`);
    } catch (e) {
        console.error("Error detecting pixel density:", e);
        // Use default value
        pixelsPerMm = 3.78;
    }
}

// Populate dropdown menu with default items
function populateDropdownMenu() {
    defaultItems.forEach(item => {
        const button = document.createElement('button');
        button.textContent = `${item.name} (${item.width}×${item.height} ${item.unit})`;
        button.addEventListener('click', () => {
            addItemToComparison(item);
            dropdownMenu.style.display = 'none';
        });
        dropdownMenu.appendChild(button);
    });
}

// Toggle dropdown menu visibility
function toggleDropdown() {
    if (dropdownMenu.style.display === 'block') {
        dropdownMenu.style.display = 'none';
    } else {
        dropdownMenu.style.display = 'block';
        // Position dropdown below the button
        const rect = addDefaultItemBtn.getBoundingClientRect();
        dropdownMenu.style.top = `${rect.bottom}px`;
        dropdownMenu.style.left = `${rect.left}px`;
    }
}

// Set the current mode (screen or real-life)
function setMode(mode) {
    isRealLifeMode = mode === 'real-life';
    
    if (isRealLifeMode) {
        screenModeBtn.style.backgroundColor = '';
        screenModeBtn.style.color = '';
        realLifeModeBtn.style.backgroundColor = 'black';
        realLifeModeBtn.style.color = 'white';
        calibrationSection.style.display = 'block';
    } else {
        realLifeModeBtn.style.backgroundColor = '';
        realLifeModeBtn.style.color = '';
        screenModeBtn.style.backgroundColor = 'black';
        screenModeBtn.style.color = 'white';
        calibrationSection.style.display = 'none';
    }
    
    // Update all items to reflect the new mode
    updateAllItems();
}

// Convert dimensions to millimeters
function convertToMm(value, unit) {
    return value * conversionToMm[unit];
}

// Helper function to safely use item names in CSS selectors
function createSafeSelector(name) {
    // Use CSS.escape if available, otherwise implement a basic escaping
    if (window.CSS && window.CSS.escape) {
        return CSS.escape(name);
    } else {
        // Basic escaping for older browsers
        return name.replace(/["\\]/g, '\\$&');
    }
}

// Add an item to the comparison area
function addItemToComparison(item) {
    // Check if the item already exists - FIXED VERSION using safe selector
    const existingItem = document.querySelector(`[data-name="${createSafeSelector(item.name)}"]`);
    if (existingItem) {
        // Update instead of adding
        updateItemSize(existingItem, item);
        return;
    }
    
    // Create new item container
    const itemElement = document.createElement('div');
    itemElement.style.display = 'inline-block';
    itemElement.style.margin = '10px';
    itemElement.style.verticalAlign = 'top';
    itemElement.style.textAlign = 'center';
    itemElement.dataset.name = item.name;
    itemElement.dataset.width = item.width;
    itemElement.dataset.height = item.height;
    itemElement.dataset.unit = item.unit;
    
    // For custom item, use the uploaded image if available
    if (item.name === "Your Item" && customItemImageUrl) {
        itemElement.dataset.image = customItemImageUrl;
    } else if (item.image) {
        itemElement.dataset.image = item.image;
    }
    
    // Create name label above the visual
    const nameDiv = document.createElement('div');
    nameDiv.textContent = item.name;
    nameDiv.style.border = '1px solid black';
    nameDiv.style.padding = '5px';
    nameDiv.style.marginBottom = '5px';
    nameDiv.style.fontWeight = 'bold';
    
    // Create the visual representation with image
    const itemVisual = document.createElement('div');
    itemVisual.style.position = 'relative';
    itemVisual.style.overflow = 'hidden';
    itemVisual.style.margin = '0 auto';
    itemVisual.style.border = '1px solid #ccc';
    
    // Special handling for "Your Item" with upload button if no image yet
    if (item.name === "Your Item" && !customItemImageUrl) {
        itemVisual.style.backgroundColor = '#f0f0f0';
        
        const uploadPrompt = document.createElement('div');
        uploadPrompt.textContent = "Click to upload image";
        uploadPrompt.style.position = 'absolute';
        uploadPrompt.style.top = '50%';
        uploadPrompt.style.left = '50%';
        uploadPrompt.style.transform = 'translate(-50%, -50%)';
        uploadPrompt.style.color = '#333';
        uploadPrompt.style.fontWeight = 'bold';
        uploadPrompt.style.cursor = 'pointer';
        
        uploadPrompt.addEventListener('click', () => {
            document.getElementById('image-upload').click();
        });
        
        itemVisual.appendChild(uploadPrompt);
        itemVisual.style.cursor = 'pointer';
        itemVisual.addEventListener('click', () => {
            document.getElementById('image-upload').click();
        });
    } 
    // Add image if available
    else if (itemElement.dataset.image) {
        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        // First check if the image exists, use placeholder if not
        const imageUrl = itemElement.dataset.image;
        img.onerror = function() {
            // If image fails to load, show a colored rectangle with the item name
            this.src = '';
            this.style.display = 'none';
            itemVisual.style.backgroundColor = '#f0f0f0';
            
            const textOverlay = document.createElement('div');
            textOverlay.textContent = item.name;
            textOverlay.style.position = 'absolute';
            textOverlay.style.top = '50%';
            textOverlay.style.left = '50%';
            textOverlay.style.transform = 'translate(-50%, -50%)';
            textOverlay.style.color = '#333';
            textOverlay.style.fontWeight = 'bold';
            itemVisual.appendChild(textOverlay);
        };
        
        img.src = imageUrl;
        itemVisual.appendChild(img);
    } else {
        // No image, just use a colored box
        itemVisual.style.backgroundColor = '#f0f0f0';
        
        const textOverlay = document.createElement('div');
        textOverlay.textContent = item.name;
        textOverlay.style.position = 'absolute';
        textOverlay.style.top = '50%';
        textOverlay.style.left = '50%';
        textOverlay.style.transform = 'translate(-50%, -50%)';
        textOverlay.style.color = '#333';
        textOverlay.style.fontWeight = 'bold';
        itemVisual.appendChild(textOverlay);
    }
    
    // Create the info section
    const itemInfo = document.createElement('div');
    itemInfo.style.marginTop = '5px';
    itemInfo.style.textAlign = 'center';
    
    // Convert to different units
    const widthMm = convertToMm(item.width, item.unit);
    const heightMm = convertToMm(item.height, item.unit);
    

    // Create unit conversion displays
    const mmLabel = document.createElement('div');
    mmLabel.textContent = `${widthMm.toFixed(0)}*${heightMm.toFixed(0)} mm`;

    const cmLabel = document.createElement('div');
    cmLabel.textContent = `${(widthMm / 10).toFixed(1)}*${(heightMm / 10).toFixed(1)} cm`;

    const mLabel = document.createElement('div');
    mLabel.textContent = `${(widthMm / 1000).toFixed(3)}*${(heightMm / 1000).toFixed(3)} m`;

    const kmLabel = document.createElement('div');
    kmLabel.textContent = `${(widthMm / 1000000).toFixed(5)}*${(heightMm / 1000000).toFixed(5)} km`;

    const inchLabel = document.createElement('div');
    inchLabel.textContent = `${(widthMm / 25.4).toFixed(2)}*${(heightMm / 25.4).toFixed(2)} inch`;

    const ftLabel = document.createElement('div');
    ftLabel.textContent = `${(widthMm / 304.8).toFixed(2)}*${(heightMm / 304.8).toFixed(2)} ft`;

    const yardLabel = document.createElement('div');
    yardLabel.textContent = `${(widthMm / 914.4).toFixed(2)}*${(heightMm / 914.4).toFixed(2)} yard`;

    const ptLabel = document.createElement('div');
    ptLabel.textContent = `${(widthMm / 0.352778).toFixed(0)}*${(heightMm / 0.352778).toFixed(0)} pt`;

    // Assemble the item
    itemInfo.appendChild(mmLabel);
    itemInfo.appendChild(cmLabel);
    itemInfo.appendChild(mLabel);
    itemInfo.appendChild(kmLabel);
    itemInfo.appendChild(inchLabel);
    itemInfo.appendChild(ftLabel);
    itemInfo.appendChild(yardLabel);
    itemInfo.appendChild(ptLabel);
    
    itemElement.appendChild(nameDiv);
    itemElement.appendChild(itemVisual);
    itemElement.appendChild(itemInfo);
    comparisonArea.appendChild(itemElement);
    
    // Update its size
    updateItemSize(itemElement, item);
}

// Update the size of an item based on the current mode
function updateItemSize(itemElement, item) {
    const visual = itemElement.querySelector('div:nth-child(2)'); // Second div is the visual
    
    // Get dimensions in mm
    const widthMm = convertToMm(item.width, item.unit);
    const heightMm = convertToMm(item.height, item.unit);
    
    if (isRealLifeMode) {
        // Real-life mode: convert mm to pixels based on screen density
        const widthPx = widthMm * pixelsPerMm;
        const heightPx = heightMm * pixelsPerMm;
        
        visual.style.width = `${widthPx}px`;
        visual.style.height = `${heightPx}px`;
    } else {
        // Screen mode: scale all items proportionally to fit nicely on screen
        // For demo purposes, we'll use a simple scaling factor
        const scaleFactor = 0.8; // Adjust as needed
        visual.style.width = `${widthMm * scaleFactor}px`;
        visual.style.height = `${heightMm * scaleFactor}px`;
    }
    
    // Update item data attributes
    itemElement.dataset.width = item.width;
    itemElement.dataset.height = item.height;
    itemElement.dataset.unit = item.unit;
    
    // For custom item, use the uploaded image if available
    if (item.name === "Your Item" && customItemImageUrl) {
        itemElement.dataset.image = customItemImageUrl;
    } else if (item.image) {
        itemElement.dataset.image = item.image;
    }
    
    // Update name display
    const nameDiv = itemElement.querySelector('div:first-child');
    if (nameDiv) {
        nameDiv.textContent = item.name;
    }
    
    // Update conversions
    const infoDiv = itemElement.querySelector('div:nth-child(3)'); // Third div is the info section
    if (infoDiv) {
        const unitDivs = infoDiv.querySelectorAll('div');
        if (unitDivs.length >= 6) {
            unitDivs[0].textContent = `${(widthMm/1000000).toFixed(5)}*${(heightMm/1000000).toFixed(5)}km`;
            unitDivs[1].textContent = `${(widthMm/10).toFixed(1)}*${(heightMm/10).toFixed(1)}cm`;
            unitDivs[2].textContent = `${widthMm.toFixed(0)}*${heightMm.toFixed(0)}mm`;
            unitDivs[3].textContent = `${(widthMm/25.4).toFixed(5)}*${(heightMm/25.4).toFixed(5)}inch`;
            unitDivs[4].textContent = `${(widthMm/914.4).toFixed(2)}*${(heightMm/914.4).toFixed(2)}yard`;
            unitDivs[5].textContent = `${(widthMm/304.8).toFixed(2)}*${(heightMm/304.8).toFixed(2)}ft`;
        }
    }
    
    // Special case for custom item: update the visual if image changed
    if (item.name === "Your Item") {
        // If we now have an image but the visual doesn't have one
        if (customItemImageUrl && !visual.querySelector('img')) {
            // Clear the visual
            visual.innerHTML = '';
            visual.style.backgroundColor = '';
            visual.style.cursor = 'pointer';
            
            // Add the new image
            const img = document.createElement('img');
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.src = customItemImageUrl;
            visual.appendChild(img);
            
            // Keep the click event to allow replacing image
            visual.addEventListener('click', () => {
                document.getElementById('image-upload').click();
            });
        }
    }
}

// Update all items in the comparison area
function updateAllItems() {
    const items = document.querySelectorAll('[data-name]');
    items.forEach(itemElement => {
        const item = {
            name: itemElement.dataset.name,
            width: parseFloat(itemElement.dataset.width),
            height: parseFloat(itemElement.dataset.height),
            unit: itemElement.dataset.unit,
            image: itemElement.dataset.image
        };
        updateItemSize(itemElement, item);
    });
}

// Update the custom item from the input fields
function updateCustomItem() {
    const name = document.getElementById('item-name').value || 'Your Item';
    const width = parseFloat(document.getElementById('item-width').value) || 0;
    const height = parseFloat(document.getElementById('item-height').value) || 0;
    const unit = document.getElementById('item-unit').value;
    
    const customItem = {
        name: name,
        width: width,
        height: height,
        unit: unit
    };
    
    // Keep using the uploaded image if available
    if (customItemImageUrl) {
        customItem.image = customItemImageUrl;
    }
    
    addItemToComparison(customItem);
}

// Set up image upload functionality
function setupImageUpload() {
    // Check if the file input already exists
    if (!document.getElementById('image-upload')) {
        // Create a file input for image upload
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'image-upload';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none'; // Hide the input
        document.body.appendChild(fileInput);
        
        // Handle file selection
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.match(/image.*/)) {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    // Store the image URL
                    customItemImageUrl = e.target.result;
                    
                    // Update the custom item with the new image
                    updateCustomItem();
                };
                
                reader.readAsDataURL(file);
            }
        });
    }
}

// Initialize
window.onload = initApp;