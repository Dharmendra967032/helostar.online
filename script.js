// Database Keys
const SUPABASE_URL = "https://axufucktgyuorwqcykkq.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Vuq82ePGI4vrov2ObLhJQQ_eZRtgkG5"; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentMode = 'long'; // Landscape

// Toggle Category Dropdown
function toggleDropdown() {
    document.getElementById("categoryDropdown").classList.toggle("show");
}

// Switch between Cinema (Long) and Shorts (Short)
async function switchMode(mode, btn) {
    currentMode = mode;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById('videoContainer').className = `video-grid mode-${mode}`;
    fetchVideos();
}

async function fetchVideos() {
    const { data, error } = await _supabase
        .from('videos')
        .select('*')
        .eq('mode', currentMode)
        .order('created_at', { ascending: false });

    const container = document.getElementById('videoContainer');
    container.innerHTML = '';

    if (data) {
        data.forEach(v => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.innerHTML = `<video src="${v.url}" controls></video>`;
            container.appendChild(card);
        });
    }
}

function triggerUpload() { document.getElementById('fileUpload').click(); }

document.getElementById('fileUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Detect Orientation
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.src = URL.createObjectURL(file);

    videoElement.onloadedmetadata = async () => {
        // Landscape (W > H) = long
        // Vertical (H > W) = short
        const mode = videoElement.videoWidth > videoElement.videoHeight ? 'long' : 'short';
        
        document.getElementById('loadingOverlay').style.display = 'flex';

        try {
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await _supabase.storage
                .from('video-uploads')
                .upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = _supabase.storage.from('video-uploads').getPublicUrl(fileName);

            await _supabase.from('videos').insert([{
                url: publicUrl,
                mode: mode, // Automatically assigned
                description: "Helostar Premium Video",
                owner: "Guest"
            }]);

            location.reload();
        } catch (err) {
            alert("Upload failed: " + err.message);
            document.getElementById('loadingOverlay').style.display = 'none';
        }
    };
});

// Initial Load
fetchVideos();