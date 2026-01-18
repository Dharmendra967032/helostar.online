// Configuration
const SUPABASE_URL = "https://axufucktgyuorwqcykkq.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Vuq82ePGI4vrov2ObLhJQQ_eZRtgkG5"; 

firebase.initializeApp({
    apiKey: "AIzaSyAd_Gds3NO1NuiWWE7kOUST_epBn_cs2xY",
    authDomain: "helostar-134d9.firebaseapp.com",
    projectId: "helostar-134d9"
});

const auth = firebase.auth();
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUserEmail = null;
let currentViewMode = 'short'; // Default mode

// Auth State
auth.onAuthStateChanged(user => { 
    if (user) startApp(user.email);
    else if (localStorage.getItem('guestUser')) startApp(localStorage.getItem('guestUser'));
});

function startApp(email) {
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('uploadBtn').style.display = 'flex';
    currentUserEmail = email;
    fetchVideos();
}

// Mode Switching Logic
function switchMode(mode) {
    currentViewMode = mode;
    
    // Update UI Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update Container Class
    const container = document.getElementById('videoContainer');
    container.className = `video-grid mode-${mode}`;
    
    fetchVideos();
}

async function fetchVideos() {
    const { data, error } = await _supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (!error) {
        const container = document.getElementById('videoContainer');
        container.innerHTML = '';
        
        // Filter logic: In a real app, you would have an 'aspect_ratio' column in Supabase.
        // Here we simulate it or let users see all in the chosen format.
        data.forEach(v => renderVideo(v));
    }
}

function renderVideo(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
        <div class="video-wrapper">
            <video src="${video.url}" playsinline controls onplay="handlePlay(this, ${video.id})"></video>
        </div>
        <div class="video-info">
            <div class="video-meta">
                <span style="font-weight:bold;">${video.description || 'Helostar Content'}</span>
                <span>@${video.owner.split('@')[0]}</span>
            </div>
            <div class="video-actions">
                <div class="action-item" onclick="handleLike(${video.id})">
                    <i class="fas fa-heart"></i> <span id="likes-${video.id}">${video.likes || 0}</span>
                </div>
                <div class="action-item">
                    <i class="fas fa-eye"></i> <span>${video.views || 0}</span>
                </div>
            </div>
        </div>`;
    document.getElementById('videoContainer').appendChild(card);
}

// Upload Logic
async function triggerUpload() {
    const fileInput = document.getElementById('fileUpload');
    fileInput.click();
}

document.getElementById('fileUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Detect aspect ratio logic can be added here
    const caption = prompt("Enter video caption:");
    document.getElementById('uploadProgress').style.display = 'block';

    try {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error: uploadError } = await _supabase.storage
            .from('video-uploads')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = _supabase.storage.from('video-uploads').getPublicUrl(fileName);

        await _supabase.from('videos').insert([{ 
            url: publicUrl, 
            description: caption, 
            owner: currentUserEmail,
            mode: currentViewMode // Saves whether it was uploaded as short or long
        }]);

        location.reload();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        document.getElementById('uploadProgress').style.display = 'none';
    }
});

// Auth Handlers
function guestMode() {
    const name = document.getElementById('guestUsername').value || "Guest";
    localStorage.setItem('guestUser', name + "@guest.com");
    location.reload();
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
}

function logout() {
    localStorage.clear();
    auth.signOut().then(() => location.reload());
}