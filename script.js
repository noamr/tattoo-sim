const canvas = new fabric.Canvas('tattoo-canvas');
const wrapper = document.getElementById('wrapper');

// Resize canvas to fit wrapper
function resizeCanvas() {
    canvas.setDimensions({
        width: wrapper.clientWidth,
        height: wrapper.clientHeight
    });
    canvas.renderAll();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- State & Storage ---
let state = [];
let mods = 0;
let isSaving = false;
let tattooGallery = JSON.parse(localStorage.getItem('tattoo-gallery') || '[]');

function saveState() {
    if (isSaving) return;
    if (mods < state.length) {
        state = state.slice(0, mods + 1);
    }
    const json = JSON.stringify(canvas);
    state.push(json);
    mods = state.length - 1;
    localStorage.setItem('tattoo-canvas-state', json);
}

function loadFromStorage() {
    const savedCanvas = localStorage.getItem('tattoo-canvas-state');
    if (savedCanvas) {
        isSaving = true;
        canvas.loadFromJSON(savedCanvas, () => {
            canvas.renderAll();
            isSaving = false;
        });
    }
    renderGallery();
}

function renderGallery() {
    const container = document.getElementById('tattoo-gallery');
    container.innerHTML = '';
    tattooGallery.forEach((dataUrl, index) => {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'gallery-item';
        img.draggable = true;
        img.dataset.index = index;
        img.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', dataUrl);
        });
        container.appendChild(img);
    });
}

function applyTattooDefaults(img) {
    img.filters = [];
    // 1. Clean background
    img.filters.push(new fabric.Image.filters.Brightness({ brightness: 0.05 }));
    img.filters.push(new fabric.Image.filters.RemoveColor({ color: '#FFFFFF', distance: 0.25 }));
    
    // 2. Classic Ink (Grayscale + Tint)
    img.filters.push(new fabric.Image.filters.Grayscale());
    img.filters.push(new fabric.Image.filters.BlendColor({ 
        color: '#0a1a2a', 
        mode: 'tint', 
        alpha: 0.5 
    }));

    // 3. Thicken (Gamma + Contrast)
    img.filters.push(new fabric.Image.filters.Gamma({ gamma: [0.6, 0.6, 0.6] }));
    img.filters.push(new fabric.Image.filters.Contrast({ contrast: 0.3 }));

    img.set('opacity', 0.8);
    img.applyFilters();
}

// --- Drag and Drop Logic ---
wrapper.addEventListener('dragover', (e) => e.preventDefault());
wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    const dataUrl = e.dataTransfer.getData('text/plain');
    if (!dataUrl) return;

    const pointer = canvas.getPointer(e);
    const activeObject = canvas.findTarget(e);
    
    fabric.Image.fromURL(dataUrl, (img) => {
        img.scaleToWidth(200);
        img.set({
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
            cornerColor: 'white',
            cornerStrokeColor: 'black',
            transparentCorners: false,
            cornerSize: 10,
            globalCompositeOperation: 'multiply'
        });

        // Apply defaults immediately
        applyTattooDefaults(img);

        if (activeObject && activeObject.type === 'image' && activeObject !== canvas.backgroundImage) {
            // Replace: Copy transformation properties from the old one
            img.set({
                left: activeObject.left,
                top: activeObject.top,
                angle: activeObject.angle,
                scaleX: (activeObject.width * activeObject.scaleX) / img.width,
                scaleY: (activeObject.height * activeObject.scaleY) / img.height
            });
            canvas.remove(activeObject);
        }

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
    });
});

// --- State Management (Undo/Redo Actions) ---
document.getElementById('undo').addEventListener('click', function() {
    if (mods > 0) {
        isSaving = true;
        mods--;
        canvas.loadFromJSON(state[mods], function() {
            canvas.renderAll();
            isSaving = false;
        });
    }
});

document.getElementById('redo').addEventListener('click', function() {
    if (mods < state.length - 1) {
        isSaving = true;
        mods++;
        canvas.loadFromJSON(state[mods], function() {
            canvas.renderAll();
            isSaving = false;
        });
    }
});

canvas.on('object:added', saveState);
canvas.on('object:modified', saveState);
canvas.on('object:removed', saveState);

// --- Download functionality ---
document.getElementById('download').addEventListener('click', function() {
    const currentZoom = canvas.getZoom();
    const currentVpt = canvas.viewportTransform.slice();
    
    canvas.setZoom(1);
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1
    });
    
    canvas.setZoom(currentZoom);
    canvas.viewportTransform = currentVpt;
    canvas.renderAll();

    const link = document.createElement('a');
    link.download = 'tattoo-simulator-result.png';
    link.href = dataURL;
    link.click();
});

// --- Skin Upload ---
document.getElementById('skin-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(f) {
        const data = f.target.result;
        fabric.Image.fromURL(data, function(img) {
            const scale = Math.min(
                canvas.width / img.width,
                canvas.height / img.height
            );
            
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                scaleX: scale,
                scaleY: scale,
                originX: 'left',
                originY: 'top',
                left: (canvas.width - img.width * scale) / 2,
                top: (canvas.height - img.height * scale) / 2
            });
            saveState();
        });
    };
    reader.readAsDataURL(file);
});

// --- Tattoo Gallery Upload ---
document.getElementById('tattoo-upload').addEventListener('change', function(e) {
    const files = e.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(f) {
            const data = f.target.result;
            tattooGallery.push(data);
            localStorage.setItem('tattoo-gallery', JSON.stringify(tattooGallery));
            renderGallery();
        };
        reader.readAsDataURL(file);
    });
});

// --- Clear Canvas ---
document.getElementById('clear-canvas').addEventListener('click', () => {
    if (confirm('Clear everything from the canvas?')) {
        canvas.clear();
        localStorage.removeItem('tattoo-canvas-state');
        saveState();
    }
});

// --- Effects ---
document.getElementById('apply-classic-ink').addEventListener('click', function() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') {
        alert('Please select a tattoo image first.');
        return;
    }
    activeObject.filters = [];
    
    // 1. Clean the background aggressively: 
    // Boost brightness first to push near-whites to pure white
    activeObject.filters.push(new fabric.Image.filters.Brightness({ brightness: 0.05 }));
    activeObject.filters.push(new fabric.Image.filters.RemoveColor({ color: '#FFFFFF', distance: 0.2 }));
    
    // 2. Grayscale & Contrast
    activeObject.filters.push(new fabric.Image.filters.Grayscale());
    activeObject.filters.push(new fabric.Image.filters.Contrast({ contrast: 0.25 }));
    
    // 3. Tint
    activeObject.filters.push(new fabric.Image.filters.BlendColor({ 
        color: '#0a1a2a', 
        mode: 'tint', 
        alpha: 0.5 
    }));

    activeObject.set('opacity', 0.8);
    activeObject.applyFilters();
    canvas.renderAll();
    saveState();
});

document.getElementById('thicken-ink').addEventListener('click', function() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') return;
    
    // Clean edges before thickening to avoid artifacts
    activeObject.filters.push(new fabric.Image.filters.Brightness({ brightness: 0.05 }));
    activeObject.filters.push(new fabric.Image.filters.RemoveColor({ color: '#FFFFFF', distance: 0.25 }));
    
    // Use Gamma to darken/thicken
    activeObject.filters.push(new fabric.Image.filters.Gamma({
        gamma: [0.6, 0.6, 0.6]
    }));
    
    activeObject.filters.push(new fabric.Image.filters.Contrast({ contrast: 0.2 }));

    activeObject.applyFilters();
    canvas.renderAll();
    saveState();
});

document.getElementById('remove-bg').addEventListener('click', function() {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') return;
    activeObject.filters.push(new fabric.Image.filters.RemoveColor({ color: '#FFFFFF', distance: 0.15 }));
    activeObject.applyFilters();
    canvas.renderAll();
    saveState();
});

document.getElementById('delete-selected').addEventListener('click', deleteSelected);

function deleteSelected() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        activeObjects.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        saveState();
    }
}

window.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName !== 'INPUT') {
        deleteSelected();
    }
});

document.getElementById('opacity').addEventListener('input', function(e) {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('opacity', parseFloat(e.target.value));
        canvas.renderAll();
        saveState();
    }
});

// --- Zoom & Pan ---
let zoomLevel = 1;
document.getElementById('zoom-in').addEventListener('click', () => { zoomLevel *= 1.1; canvas.setZoom(zoomLevel); });
document.getElementById('zoom-out').addEventListener('click', () => { zoomLevel /= 1.1; canvas.setZoom(zoomLevel); });
document.getElementById('reset-view').addEventListener('click', () => {
    zoomLevel = 1;
    canvas.setZoom(1);
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    canvas.renderAll();
});

canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 20) zoom = 20;
    if (zoom < 0.01) zoom = 0.01;
    canvas.setZoom(zoom);
    zoomLevel = zoom;
    opt.e.preventDefault();
    opt.e.stopPropagation();
});

canvas.on('mouse:down', function(opt) {
    if (opt.e.altKey === true) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
    }
});

canvas.on('mouse:move', function(opt) {
    if (this.isDragging) {
        var e = opt.e;
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
    }
});

canvas.on('mouse:up', function() {
    this.setViewportTransform(this.viewportTransform);
    this.isDragging = false;
    this.selection = true;
});

// Initial Setup
setTimeout(loadFromStorage, 100);
