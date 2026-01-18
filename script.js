// Initialize Supabase
const _supabase = supabase.createClient("YOUR_URL", "YOUR_KEY");

let currentView = 'long'; // Landscape by default

function switchMode(mode) {
    currentView = mode;
    // Update Menu UI
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if(item.innerText.toLowerCase().includes(mode)) item.classList.add('active');
    });

    const container = document.getElementById('videoContainer');
    container.className = `video-display-area mode-${mode}`;
    fetchVideos();
}

async function fetchVideos() {
    const { data } = await _supabase.from('videos').select('*').eq('category', currentView);
    
    const container = document.getElementById('videoContainer');
    container.innerHTML = data.map(v => `
        <div class="video-card">
            <video src="${v.url}" controls playsinline loop></video>
            <div class="v-info">
                <h4>${v.title}</h4>
            </div>
        </div>
    `).join('');
}

function triggerUpload() { document.getElementById('fileUpload').click(); }

document.getElementById('fileUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Detect Orientation
    const v = document.createElement('video');
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = async () => {
        const isLandscape = v.videoWidth > v.videoHeight;
        const uploadMode = isLandscape ? 'long' : 'short';
        
        // Start Upload
        document.getElementById('uploadOverlay').classList.add('active');
        
        // ... (Supabase Upload Logic here)
        // Ensure you save 'uploadMode' into the 'category' column
        
        alert(`Uploaded as ${uploadMode} video!`);
        location.reload();
    };
});