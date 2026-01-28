// --- CONFIG ---
    const SUPABASE_URL = "https://axufucktgyuorwqcykkq.supabase.co"; 
    const SUPABASE_ANON_KEY = "sb_publishable_Vuq82ePGI4vrov2ObLhJQQ_eZRtgkG5"; 

    firebase.initializeApp({
      apiKey: "AIzaSyAd_Gds3NO1NuiWWE7kOUST_epBn_cs2xY",
      authDomain: "helostar-134d9.firebaseapp.com",
      projectId: "helostar-134d9"
    });

    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let currentUserEmail = null;
    let currentTab = 'short';
    let currentCat = 'All';
    let isGuest = false;

    // --- AUTH ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) { 
            currentUserEmail = user.email;
            const userDisplay = document.getElementById('userDisplay');
            if(userDisplay) {
                userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${user.displayName || user.email.split('@')[0]}`;
            }
            start(false); 
        } else if (localStorage.getItem('guest')) {
            start(true);
        }
    });

// --- AUTO-PLAY / AUTO-PAUSE LOGIC ---
    const observerOptions = { threshold: 0.6 };
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const vid = entry.target;
            if (entry.isIntersecting) {
                vid.play().catch(() => {});
                incrementView(vid.dataset.id);
            } else {
                vid.pause();
            }
        });
    }, observerOptions);

    function start(g) {
        isGuest = g;
        const authOverlay = document.getElementById('authOverlay');
        if(authOverlay) authOverlay.classList.add('hidden');
        
        if(isGuest) {
            const logoutBtn = document.getElementById('logoutMenuBtn');
            if(logoutBtn) logoutBtn.classList.add('hidden');
            const userDisplay = document.getElementById('userDisplay');
            if(userDisplay) userDisplay.innerHTML = `<i class="fas fa-user-secret"></i> Guest Mode`;
        } else {
            const uploadBtn = document.getElementById('uploadBtn');
            if(uploadBtn) uploadBtn.style.display = 'flex';
        }
        renderFeed();
    }

    // --- UPLOAD LOGIC ---
    const fileInElement = document.getElementById('fileIn');
    if(fileInElement) {
        fileInElement.onchange = async (e) => {
            if(isGuest) return alert("Please login to upload!");
            const file = e.target.files[0];
            if(!file) return;

            const desc = prompt("Enter video description:");
            if(desc === null) return; // User cancelled description prompt
            
            const category = prompt("Enter category (Comedy, Party, Bhakti, Tech, Love, Sad, Others etc):") || 'All';
            
            // Ask for thumbnail
            const proceedWithoutThumb = confirm("Select thumbnail? (Cancel to skip and upload video)");
            
            let thumbnailUrl = null;
            
            if(proceedWithoutThumb) {
                // Create file input for thumbnail
                const thumbInput = document.createElement('input');
                thumbInput.type = 'file';
                thumbInput.accept = 'image/*';
                
                thumbInput.onchange = async (thumbEvent) => {
                    const thumbFile = thumbEvent.target.files[0];
                    if(thumbFile) {
                        try {
                            const thumbFileName = `thumb_${Date.now()}_${thumbFile.name}`;
                            const { error: thumbErr } = await _supabase.storage.from('thumbnails').upload(thumbFileName, thumbFile);
                            
                            if(!thumbErr) {
                                const { data: thumbUrl } = _supabase.storage.from('thumbnails').getPublicUrl(thumbFileName);
                                thumbnailUrl = thumbUrl.publicUrl;
                            }
                        } catch(err) {
                            console.error('Thumbnail upload error:', err);
                        }
                    }
                    uploadVideo();
                };
                
                thumbInput.click();
            } else {
                uploadVideo();
            }
            
            async function uploadVideo() {
                try {
                    const fileName = `${Date.now()}_${file.name}`;
                    
                    // 1. Upload to Supabase Storage
                    const { error: uploadErr } = await _supabase.storage
                        .from('videos')
                        .upload(fileName, file);

                    if(uploadErr) return alert("Upload failed: " + uploadErr.message);

                    // 2. Get Public URL
                    const { data: urlData } = _supabase.storage.from('videos').getPublicUrl(fileName);

                    // 3. Save to Database
                    const { error: dbErr } = await _supabase.from('videos').insert([{
                        url: urlData.publicUrl,
                        thumbnail_url: thumbnailUrl || '',
                        description: desc || "No description",
                        owner: currentUserEmail,
                        category: category,
                        likes: 0,
                        views: 0
                    }]);

                    if(dbErr) return alert("Database error: " + dbErr.message);

                    alert("Upload Success!");
                    renderFeed();
                } catch(err) {
                    console.error('Upload error:', err);
                    alert("Upload failed: " + err.message);
                }
            }
            
            // Click the thumbnail input
            thumbInput.click();
            
            // If no thumbnail is selected after 3 seconds, still upload
            setTimeout(() => {
                if(!uploadAttempted) {
                    uploadAttempted = true;
                    uploadVideo();
                }
            }, 3000);
        };
    }

    // --- INTERACTIONS ---
    async function incrementView(id) {
        // Calls the SQL function created in Supabase
        await _supabase.rpc('increment_views', { row_id: id });
    }
    // --- FEED LOGIC ---
    async function renderFeed() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const feed = document.getElementById('feed');
        if(!feed) return;
        
        feed.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.4;">Loading...</p>';
        
        let q = _supabase.from('videos').select('*').order('created_at', {ascending: false});
        if (currentCat !== 'All') q = q.eq('category', currentCat);
        
        const { data: videos } = await q;
        
        // Pre-fetch all user profiles/avatars in one query
        if(videos && videos.length > 0) {
            const uniqueEmails = [...new Set(videos.map(v => v.owner))];
            const { data: profiles } = await _supabase.from('profiles').select('email, avatar_url').in('email', uniqueEmails);
            window.profileAvatarMap = {};
            if(profiles) {
                profiles.forEach(p => {
                    window.profileAvatarMap[p.email] = p.avatar_url;
                });
            }
        }
        feed.innerHTML = '';
        if(!videos || videos.length === 0) {
            feed.innerHTML = '<p style="text-align:center; padding:50px; opacity:0.4;">No videos found</p>';
            return;
        }

        const filtered = videos.filter(v => 
            v.description.toLowerCase().includes(searchTerm) || 
            v.owner.toLowerCase().includes(searchTerm)
        );

        filtered.forEach(v => {
            const vTemp = document.createElement('video');
            vTemp.src = v.url;
            vTemp.onloadedmetadata = () => {
                const isVertical = vTemp.videoHeight > vTemp.videoWidth;
                if ((currentTab === 'short' && isVertical) || (currentTab === 'full' && !isVertical)) {
                    createCard(v, isVertical);
                }
            };
            vTemp.onerror = () => {
                console.error('Video load error:', v.url);
            };
        });
    }

    function createCard(v, isVertical) {
        const card = document.createElement('div');
        card.className = 'card';
        const followBtn = currentUserEmail !== v.owner ? 
        `<button class="btn-follow" data-creator="${v.owner}" data-video-id="${v.id}" onclick="toggleFollow('${v.owner}', this)"><span class="follow-text">Follow</span></button>` : `<span style="font-size:0.8rem; color:#999;">Your Video</span>`;
        
        // 3-dot menu for owner only
        const menuBtn = currentUserEmail === v.owner ? 
        `<div class="video-menu-wrapper">
            <button class="video-menu-btn" onclick="toggleVideoMenu(event, ${v.id})">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="video-menu-dropdown" id="menu-${v.id}" style="display: none;">
                <div class="video-menu-item" onclick="editDescription(${v.id}, null)">
                    <i class="fas fa-edit"></i> Edit Description
                </div>
                <div class="video-menu-item delete-item" onclick="deleteVideo(${v.id}, null)">
                    <i class="fas fa-trash"></i> Delete Video
                </div>
            </div>
        </div>` : '';
        
        const avatarUrl = window.profileAvatarMap && window.profileAvatarMap[v.owner] ? window.profileAvatarMap[v.owner] : 'https://via.placeholder.com/150';
        
        card.innerHTML = `
        <div class="card-header">
            <img src="${avatarUrl}" class="user-avatar" style="cursor: ${currentUserEmail === v.owner ? 'pointer' : 'default'};\" data-email="${v.owner}"
            onclick="${currentUserEmail === v.owner ? 'updateProfilePicture()' : ''}">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.9rem;">@${v.owner.split('@')[0]}</div>
                <div class="follower-count" data-creator="${v.owner}" style="font-size:0.75rem; color:#999;">0 followers</div>
            </div>
            ${followBtn}
            ${menuBtn}
        </div>
            
            <div class="v-wrap ${isVertical ? 'v-short' : 'v-full'}">
                <video 
                src="${v.url}" 
                poster="${v.thumbnail_url || ''}" 
                ${isVertical ? 'loop playsinline' : 'controls'}
                onclick="togglePlay(this)"
            ></video>
               
            </div>
            
            <div class="action-row" ${isVertical ? 'style="position:relative;"' : ''}>
                <button class="btn-act like-btn" data-id="${v.id}" data-liked="false" onclick="event.stopPropagation(); handleLike(this, '${v.id}')">
                    <i class="fas fa-heart"></i> <span class="count">${v.likes || 0}</span>
                </button>
                <button class="btn-act" onclick="event.stopPropagation(); toggleComments('${v.id}')">
                    <i class="fas fa-comment"></i> <span class="comment-count" data-id="${v.id}">0</span>
                </button>
                <button class="btn-act">
                    <i class="fas fa-eye"></i> <span class="view-count" data-id="${v.id}">${v.views || 0}</span>
                </button>
                <button class="btn-act share-btn" onclick="event.stopPropagation(); handleShare('${v.url}', this)" data-desc="${v.description.replace(/"/g, '&quot;')}">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            
            <div id="comm-panel-${v.id}" class="comm-panel">
                <div id="list-${v.id}" class="comm-list"></div>
                <div class="comm-input-wrap">
                    <input type="text" id="input-${v.id}" class="comm-input" placeholder="Add comment...">
                    <button class="comm-post-btn" onclick="postComment('${v.id}')"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
            <div style="padding:0 15px 15px 15px;">
                <b>@${v.owner.split('@')[0]}</b> <span id="desc-${v.id}">${v.description}</span>
                <div style="color:var(--helostar-pink); font-size:0.75rem; margin-top:5px;">#${v.category}</div>
            </div>`;
        document.getElementById('feed').appendChild(card);
        
        // Attach video reference and auto-play/pause logic
        const videoElem = card.querySelector('video');
        const vWrap = card.querySelector('.v-wrap');
        const actionRow = card.querySelector('.action-row');
        
        videoElem.onplay = () => pauseAllOtherVideos(videoElem);
        videoElem.onended = () => playNextVideo(card);
        videoObserver.observe(videoElem);
        
        // Instagram-style shorts experience
        if(isVertical) {
            // Add tap listener to v-wrap directly
            vWrap.addEventListener('touchend', (e) => {
                const touchX = e.changedTouches[0].clientX;
                const touchY = e.changedTouches[0].clientY;
                const rect = vWrap.getBoundingClientRect();
                const relativeTouchX = touchX - rect.left;
                const relativeHeight = rect.height;
                const relativeWidth = rect.width;
                
                // Determine which third was tapped
                if (relativeTouchX < relativeWidth / 3) {
                    // LEFT - mute/unmute
                    videoElem.muted = !videoElem.muted;
                    showReelsFeedback(videoElem.muted ? 'mute' : 'unmute');
                } else if (relativeTouchX > (relativeWidth * 2 / 3)) {
                    // RIGHT - like
                    const likeBtn = card.querySelector(`.like-btn[data-id="${v.id}"]`);
                    if(likeBtn) {
                        likeBtn.click();
                        showReelsFeedback('like');
                    }
                } else {
                    // CENTER - fullscreen
                    const isFs = vWrap.classList.contains('reels-fs');
                    if(!isFs) {
                        enterReelsFullscreen(card, vWrap, videoElem);
                    } else {
                        exitReelsFullscreen(card, vWrap, videoElem);
                    }
                }
            }, false);
            
            // Swipe detection
            let touchStartY = 0;
            
            vWrap.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            }, false);
            
            vWrap.addEventListener('touchend', (e) => {
                const touchEndY = e.changedTouches[0].clientY;
                const diff = touchStartY - touchEndY;
                
                if(Math.abs(diff) > 100) {
                    if(diff > 100) {
                        // SWIPE UP - next
                        let nextCard = card.nextElementSibling;
                        while(nextCard && !nextCard.classList.contains('card')) {
                            nextCard = nextCard.nextElementSibling;
                        }
                        if(nextCard) {
                            nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                const vid = nextCard.querySelector('video');
                                if(vid) vid.play().catch(() => {});
                            }, 300);
                        }
                    } else if(diff < -100) {
                        // SWIPE DOWN - previous
                        let prevCard = card.previousElementSibling;
                        while(prevCard && !prevCard.classList.contains('card')) {
                            prevCard = prevCard.previousElementSibling;
                        }
                        if(prevCard) {
                            prevCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                const vid = prevCard.querySelector('video');
                                if(vid) vid.play().catch(() => {});
                            }, 300);
                        }
                    }
                }
            }, false);
        }
        
        // Load initial comments count and check if user liked
        loadCommentsCount(v.id);
        checkUserLike(v.id);
        checkUserFollow(v.owner);
        loadFollowerCount(v.owner, card);
        
        // Fetch and display user avatar
        fetchUserAvatar(v.owner, card);
        
        card.setAttribute('data-video-id', v.id);
    }

    async function loadFollowerCount(creatorEmail, card) {
        try {
            const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', creatorEmail);
            const followerCount = followers ? followers.length : 0;
            const followerEl = card.querySelector(`.follower-count[data-creator="${creatorEmail}"]`);
            if(followerEl) {
                followerEl.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
            }
        } catch(err) {
            console.error('Follower count error:', err);
        }
    }

    async function fetchUserAvatar(email, card) {
        try {
            // Use pre-fetched avatar from map
            if(window.profileAvatarMap && window.profileAvatarMap[email]) {
                const avatarImg = card.querySelector('.user-avatar');
                if(avatarImg) {
                    avatarImg.src = window.profileAvatarMap[email];
                }
            }
        } catch(err) {
            console.error('Avatar fetch error:', err);
        }
    }

    function pauseAllOtherVideos(currentVideo) {
        document.querySelectorAll('video').forEach(vid => {
            if (vid !== currentVideo) vid.pause();
        });
    }

    function playNextVideo(currentCard) {
        const nextCard = currentCard.nextElementSibling;
        while(nextCard && !nextCard.classList.contains('card')) {
            nextCard = nextCard.nextElementSibling;
        }
        
        if (nextCard && nextCard.classList.contains('card')) {
            const nextVideo = nextCard.querySelector('video');
            if (nextVideo) {
                // Check if we're in fullscreen mode
                const isInFullscreen = currentCard.classList.contains('fullscreen-active');
                
                if(isInFullscreen) {
                    // Exit fullscreen when video ends
                    const vWrap = currentCard.querySelector('.v-wrap');
                    const actionRow = currentCard.querySelector('.action-row');
                    if(vWrap && vWrap.classList.contains('fullscreen-short')) {
                        toggleFullscreenShort(currentCard, vWrap, actionRow);
                    }
                }
                
                // Auto-swipe/scroll to next video
                setTimeout(() => {
                    nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 200);
                
                // Auto-play next video
                setTimeout(() => {
                    nextVideo.play().catch(() => {});
                }, 1200);
            }
        }
        
    }

    // --- INTERACTIONS ---
    async function handleLike(btn, id) {
        if(isGuest) return alert("Login to like!");
        
        
        btn.classList.toggle('liked');
        btn.dataset.liked = 'true';
        const countSpan = btn.querySelector('.count');
        let currentLikes = parseInt(countSpan.innerText);
        
        const newLikes = currentLikes + 1;
        countSpan.innerText = newLikes;

        // Save like to database with user email
        await _supabase.from('videos').update({ likes: newLikes }).eq('id', id);
        
        // Save like record to track user likes
        await _supabase.from('likes').insert([{
            video_id: id,
            user_email: currentUserEmail
        }]).select();
    }

    async function checkUserLike(videoId) {
        if(isGuest) return;
        const { data } = await _supabase.from('likes').select('*').eq('video_id', videoId).eq('user_email', currentUserEmail);
        
        if(data && data.length > 0) {
            const likeBtn = document.querySelector(`.like-btn[data-id="${videoId}"]`);
            if(likeBtn) {
                likeBtn.classList.add('liked');
                likeBtn.dataset.liked = 'true';
            }
        }
    }

    async function loadCommentsCount(videoId) {
        const { data } = await _supabase.from('comments').select('*').eq('video_id', videoId);
        const countSpan = document.querySelector(`.comment-count[data-id="${videoId}"]`);
        if(countSpan) {
            countSpan.innerText = data ? data.length : 0;
        }
    }

    async function checkUserFollow(creatorEmail) {
        if(isGuest || currentUserEmail === creatorEmail) return;
        
        // Check if user is following
        const { data } = await _supabase.from('follows').select('*').eq('follower_email', currentUserEmail).eq('following_email', creatorEmail);
        
        if(data && data.length > 0) {
            const followBtns = document.querySelectorAll(`.btn-follow[data-creator="${creatorEmail}"]`);
            followBtns.forEach(followBtn => {
                followBtn.classList.add('following');
                const textSpan = followBtn.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = 'Following';
                } else {
                    followBtn.innerText = 'Following';
                }
            });
        }
        
        // Get follower count
        const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', creatorEmail);
        const followerCount = followers ? followers.length : 0;
        
        // Update all follower count displays for this creator
        document.querySelectorAll(`.follower-count[data-creator="${creatorEmail}"]`).forEach(el => {
            el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
        });
    }

    function handleShare(url, btn) {
        const desc = btn.dataset.desc;
        if (navigator.share) {
            navigator.share({ title: 'Helostar', text: desc, url: url });
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    }

    function toggleComments(id) {
        const panel = document.getElementById(`comm-panel-${id}`);
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        if(panel.style.display === 'block') loadComments(id);
    }

    async function loadComments(id) {
        const list = document.getElementById(`list-${id}`);
        const { data } = await _supabase.from('comments').select('*').eq('video_id', id);
        
        if(data && data.length) {
            list.innerHTML = data.map(c => {
                return `<div class="comm-item">${c.comment_text}</div>`;
            }).join('');
        } else {
            list.innerHTML = '<div style="font-size:0.85rem; color:#888;">No comments yet.</div>';
        }
    }

    async function postComment(id) {
        if(isGuest) return alert("Please Login");
        const input = document.getElementById(`input-${id}`);
        if(!input.value.trim()) return;
        
        const commentText = input.value;
        input.value = '';
        input.disabled = true;
        
        try {
            const { error } = await _supabase.from('comments').insert([{ 
                video_id: id, 
                comment_text: commentText
            }]);
            
            if(error) throw error;
            
            await new Promise(r => setTimeout(r, 300));
            await loadComments(id);
            await loadCommentsCount(id);
        } catch(err) {
            console.error('Comment Error:', err);
            alert('Error posting comment: ' + err.message);
            input.value = commentText;
        } finally {
            input.disabled = false;
        }
    }
    function togglePlay(vid) { vid.paused ? vid.play() : vid.pause(); }
    
    function toggleMute(btn) {
        const vid = btn.closest('.v-wrap').querySelector('video');
        vid.muted = !vid.muted;
        btn.innerHTML = vid.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    }

    function toggleFullscreenShort(card, vWrap, actionRow) {
        const isFullscreen = vWrap.classList.contains('fullscreen-short');
        
        if(!isFullscreen) {
            // Enter fullscreen
            vWrap.classList.add('fullscreen-short');
            card.classList.add('fullscreen-active');
            actionRow.style.position = 'fixed';
            actionRow.style.bottom = '60px';
            actionRow.style.left = '15px';
            actionRow.style.right = '15px';
            actionRow.style.zIndex = '1000';
            actionRow.style.background = 'transparent';
            actionRow.style.width = 'auto';
            document.body.style.overflow = 'hidden';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            
            // Style action buttons to be transparent
            actionRow.querySelectorAll('.btn-act').forEach(btn => {
                btn.style.background = 'rgba(0,0,0,0.2)';
                btn.style.border = '1px solid rgba(255,255,255,0.15)';
            });
            
            // Hide other cards
            document.querySelectorAll('.card').forEach(c => {
                if(c !== card) c.style.display = 'none';
            });
            document.querySelector('header').style.display = 'none';
            document.querySelector('.nav-tabs').style.display = 'none';
        } else {
            // Exit fullscreen
            vWrap.classList.remove('fullscreen-short');
            card.classList.remove('fullscreen-active');
            actionRow.style.position = 'relative';
            actionRow.style.bottom = 'auto';
            actionRow.style.left = 'auto';
            actionRow.style.right = 'auto';
            actionRow.style.zIndex = 'auto';
            actionRow.style.background = 'transparent';
            actionRow.style.width = '100%';
            document.body.style.overflow = 'auto';
            document.body.style.margin = '';
            document.body.style.padding = '';
            
            // Reset button styles
            actionRow.querySelectorAll('.btn-act').forEach(btn => {
                btn.style.background = '';
                btn.style.border = '';
            });
            
            // Show all cards and UI
            document.querySelectorAll('.card').forEach(c => c.style.display = 'block');
            document.querySelector('header').style.display = 'block';
            document.querySelector('.nav-tabs').style.display = 'flex';
        }
    }
    
    // --- VIDEO MENU ---
    function toggleVideoMenu(event, videoId) {
        event.stopPropagation();
        // Close all other menus
        document.querySelectorAll('.video-menu-dropdown').forEach(m => {
            if(m.id !== `menu-${videoId}`) m.style.display = 'none';
        });
        // Toggle this menu
        const menu = document.getElementById(`menu-${videoId}`);
        if(menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // --- UI HELPERS ---
    function toggleSearch() {
        const container = document.getElementById('searchContainer');
        const logo = document.getElementById('headerLogo');
        container.classList.toggle('expanded');
        if(container.classList.contains('expanded')) {
            logo.style.opacity = '0';
            document.getElementById('searchInput').focus();
        } else { logo.style.opacity = '1'; }
    }
    function toggleMenu() { document.getElementById('catDropdown').classList.toggle('show'); }
    function filterByCat(cat) { currentCat = cat; toggleMenu(); renderFeed(); }
    function setTab(t) {
        currentTab = t;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(t === 'short' ? 'tShort' : 'tFull').classList.add('active');
        renderFeed();
    }
    function logout() { localStorage.clear(); firebase.auth().signOut().then(() => location.reload()); }
    function guestMode() { localStorage.setItem('guest', '1'); location.reload(); }
    function signInWithGoogle() { firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }

    window.onclick = function(event) {
        if (!event.target.matches('.menu-trigger') && !event.target.closest('.dropdown-content')) {
            const dropdowns = document.getElementsByClassName("dropdown-content");
            for (let d of dropdowns) { if (d.classList.contains('show')) d.classList.remove('show'); }
        }
        
        // Close video menus when clicking elsewhere
        if (!event.target.closest('.video-menu-wrapper')) {
            document.querySelectorAll('.video-menu-dropdown').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    }

    async function toggleFollow(targetEmail, btn) {
    if (isGuest) return alert("Login to follow creators!");
    if (targetEmail === currentUserEmail) return alert("You cannot follow yourself!");

    const isFollowing = btn.classList.contains('following');
    
    if (isFollowing) {
        // Unfollow Logic
        const { error } = await _supabase.from('follows')
            .delete()
            .eq('follower_email', currentUserEmail)
            .eq('following_email', targetEmail);
        
        if (!error) {
            // Update UI for all cards belonging to this creator
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.remove('following');
                const textSpan = b.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = "Follow";
                } else {
                    b.innerText = "Follow";
                }
            });
            
            // Update follower count
            const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', targetEmail);
            const followerCount = followers ? followers.length : 0;
            document.querySelectorAll(`.follower-count[data-creator="${targetEmail}"]`).forEach(el => {
                el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
            });
        }
    } else {
        // Follow Logic
        const { error } = await _supabase.from('follows')
            .insert([{ follower_email: currentUserEmail, following_email: targetEmail }]);
        
        if (!error) {
            document.querySelectorAll(`.btn-follow[data-creator="${targetEmail}"]`).forEach(b => {
                b.classList.add('following');
                const textSpan = b.querySelector('.follow-text');
                if(textSpan) {
                    textSpan.innerText = "Following";
                } else {
                    b.innerText = "Following";
                }
            });
            
            // Update follower count
            const { data: followers } = await _supabase.from('follows').select('*').eq('following_email', targetEmail);
            const followerCount = followers ? followers.length : 0;
            document.querySelectorAll(`.follower-count[data-creator="${targetEmail}"]`).forEach(el => {
                el.innerText = followerCount + (followerCount === 1 ? ' follower' : ' followers');
            });
        }
    }
}

// Triggered when user clicks the upload button
async function handleUpload() {
    if(isGuest) return alert("Please login to upload!");
    
    const videoIn = document.getElementById('fileIn');
    videoIn.onchange = async (e) => {
        const videoFile = e.target.files[0];
        
        // Create an image input on the fly for the thumbnail
        const thumbIn = document.createElement('input');
        thumbIn.type = 'file'; thumbIn.accept = 'image/*';
        alert("Video selected! Now please select a thumbnail image (Cover).");
        
        thumbIn.onchange = async (te) => {
            const thumbFile = te.target.files[0];
            const desc = prompt("Enter video description:");
            
            const vName = `vid_${Date.now()}`;
            const tName = `thumb_${Date.now()}`;

            // Upload Video
            await _supabase.storage.from('videos').upload(vName, videoFile);
            const vUrl = _supabase.storage.from('videos').getPublicUrl(vName).data.publicUrl;

            // Upload Thumbnail
            await _supabase.storage.from('thumbnails').upload(tName, thumbFile);
            const tUrl = _supabase.storage.from('thumbnails').getPublicUrl(tName).data.publicUrl;

            // Save to DB
            await _supabase.from('videos').insert([{
                url: vUrl,
                thumbnail_url: tUrl,
                description: desc,
                owner: currentUserEmail,
                category: currentCat
            }]);

            alert("Uploaded successfully!");
            renderFeed();
        };
        thumbIn.click();
    };
    videoIn.click();
}

async function updateProfilePicture() {
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*';
    fileIn.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            if(!file) return;

            const fileName = `avatar_${currentUserEmail}_${Date.now()}`;
            
            // 1. Upload to 'avatars' bucket
            const { error: uploadErr } = await _supabase.storage.from('avatars').upload(fileName, file);
            if(uploadErr) {
                alert("Upload failed: " + uploadErr.message);
                return;
            }

            const { data: urlData } = _supabase.storage.from('avatars').getPublicUrl(fileName);
            
            // 2. Update profiles table - try insert first, then update if exists
            const { error: insertErr } = await _supabase.from('profiles').insert({ 
                email: currentUserEmail, 
                avatar_url: urlData.publicUrl 
            });
            
            if(insertErr) {
                // If insert fails (already exists), update instead
                const { error: updateErr } = await _supabase.from('profiles').update({ 
                    avatar_url: urlData.publicUrl 
                }).eq('email', currentUserEmail);
                
                if(updateErr) {
                    alert("Update failed: " + updateErr.message);
                    return;
                }
            }
            
            // 3. Update all avatar images on the page
            document.querySelectorAll('.user-avatar').forEach(img => {
                if(img.style.cursor === 'pointer') {
                    img.src = urlData.publicUrl;
                }
            });
            
            alert("Profile Picture Updated!");
            // Reload to refresh everything
            location.reload();
        } catch(err) {
            console.error('Profile update error:', err);
            alert("Error: " + err.message);
        }
    };
    fileIn.click();
}

// Delete video function
async function deleteVideo(videoId, btn) {
    if(!confirm("Are you sure you want to delete this video permanently?")) return;
    
    try {
        // Close the menu first
        const menu = document.getElementById(`menu-${videoId}`);
        if(menu) menu.style.display = 'none';
        
        // Find the video record to get file names
        const { data: video } = await _supabase.from('videos').select('*').eq('id', videoId).single();
        
        // Delete video file from storage
        if(video && video.url) {
            const videoFileName = video.url.split('/').pop();
            await _supabase.storage.from('videos').remove([videoFileName]).catch(e => console.log('Video file already gone or error:', e));
        }
        
        // Delete thumbnail if exists
        if(video && video.thumbnail_url) {
            const thumbFileName = video.thumbnail_url.split('/').pop();
            await _supabase.storage.from('thumbnails').remove([thumbFileName]).catch(e => console.log('Thumbnail already gone or error:', e));
        }
        
        // Delete from database
        const { error } = await _supabase.from('videos').delete().eq('id', videoId);
        
        if(error) {
            alert("Error deleting video: " + error.message);
            return;
        }
        
        alert("Video deleted successfully!");
        // Find and remove card from DOM immediately
        const card = document.querySelector(`[data-video-id="${videoId}"]`);
        if(card) card.remove();
        
        // Then refresh feed
        setTimeout(() => renderFeed(), 500);
    } catch(err) {
        console.error('Delete Error:', err);
        alert("Error deleting video: " + err.message);
    }
}

// Edit description function
async function editDescription(videoId, btn) {
    const descSpan = document.getElementById(`desc-${videoId}`);
    const currentDesc = descSpan ? descSpan.innerText : '';
    
    const newDesc = prompt("Edit video description:", currentDesc);
    if(newDesc === null) return; // User cancelled
    if(newDesc === currentDesc) return alert("Description is the same!");
    
    try {
        const { error } = await _supabase.from('videos').update({ description: newDesc }).eq('id', videoId);
        
        if(error) {
            alert("Error updating description: " + error.message);
            return;
        }
        
        // Update the description on the page
        if(descSpan) {
            descSpan.innerText = newDesc;
        }
        
        alert("Description updated successfully!");
    } catch(err) {
        console.error('Edit Error:', err);
        alert("Error updating description: " + err.message);
    }
}

// Shorts feature functions - Instagram style
function showReelsFeedback(type) {
    const feedback = document.createElement('div');
    feedback.className = 'reels-feedback';
    
    if(type === 'mute') {
        feedback.innerHTML = '<i class="fas fa-volume-mute"></i>';
        feedback.style.left = '30px';
    } else if(type === 'unmute') {
        feedback.innerHTML = '<i class="fas fa-volume-up"></i>';
        feedback.style.left = '30px';
    } else if(type === 'like') {
        feedback.innerHTML = '<i class="fas fa-heart"></i>';
        feedback.style.right = '30px';
        feedback.style.left = 'auto';
    }
    
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 600);
}

function enterReelsFullscreen(card, vWrap, video) {
    // Add fullscreen class
    vWrap.classList.add('reels-fs');
    card.classList.add('reels-fs-card');
    
    // Hide UI elements
    const header = card.querySelector('.card-header');
    const actionRow = card.querySelector('.action-row');
    const desc = card.querySelector('div:last-child');
    
    if(header) header.style.display = 'none';
    if(actionRow) actionRow.style.display = 'none';
    if(desc && desc.textContent.includes('@')) desc.style.display = 'none';
    
    // Hide page UI
    const pageHeader = document.querySelector('header');
    const navTabs = document.querySelector('.nav-tabs');
    if(pageHeader) pageHeader.style.display = 'none';
    if(navTabs) navTabs.style.display = 'none';
    
    // Hide other cards
    document.querySelectorAll('.card').forEach(c => {
        if(c !== card) c.style.display = 'none';
    });
    
    // Fullscreen styles
    vWrap.style.position = 'fixed';
    vWrap.style.top = '0';
    vWrap.style.left = '0';
    vWrap.style.width = '100vw';
    vWrap.style.height = '100vh';
    vWrap.style.zIndex = '9999';
    vWrap.style.margin = '0';
    vWrap.style.padding = '0';
    
    // Video fill
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    
    // Prevent scroll
    document.body.style.overflow = 'hidden';
    
    // Play
    video.play().catch(() => {});
}

function exitReelsFullscreen(card, vWrap, video) {
    // Remove fullscreen class
    vWrap.classList.remove('reels-fs');
    card.classList.remove('reels-fs-card');
    
    // Show UI elements
    const header = card.querySelector('.card-header');
    const actionRow = card.querySelector('.action-row');
    const desc = card.querySelector('div:last-child');
    
    if(header) header.style.display = 'flex';
    if(actionRow) actionRow.style.display = 'flex';
    if(desc && desc.textContent.includes('@')) desc.style.display = 'block';
    
    // Show page UI
    const pageHeader = document.querySelector('header');
    const navTabs = document.querySelector('.nav-tabs');
    if(pageHeader) pageHeader.style.display = 'block';
    if(navTabs) navTabs.style.display = 'flex';
    
    // Show all cards
    document.querySelectorAll('.card').forEach(c => {
        c.style.display = '';
    });
    
    // Reset styles
    vWrap.style.position = '';
    vWrap.style.top = '';
    vWrap.style.left = '';
    vWrap.style.width = '';
    vWrap.style.height = '';
    vWrap.style.zIndex = '';
    vWrap.style.margin = '';
    vWrap.style.padding = '';
    
    // Reset video
    video.style.width = '';
    video.style.height = '';
    video.style.objectFit = '';
    
    // Restore scroll
    document.body.style.overflow = '';
}

function reelsTapHandler(event, zone, videoId) {
    // This function is no longer used but kept for compatibility
}

function toggleVideoMute(video) {
    if(!video) return;
    video.muted = !video.muted;
}

function toggleFullscreenComments(card, videoId) {
    const commPanel = card.querySelector(`#comm-panel-${videoId}`);
    if(!commPanel) return;
    
    if(commPanel.style.display === 'none' || commPanel.style.display === '') {
        // Show comments overlay
        commPanel.style.position = 'fixed';
        commPanel.style.bottom = '0';
        commPanel.style.left = '0';
        commPanel.style.right = '0';
        commPanel.style.display = 'block';
        commPanel.style.backgroundColor = 'rgba(0,0,0,0.95)';
        commPanel.style.zIndex = '9999';
        commPanel.style.height = 'auto';
        commPanel.style.borderRadius = '20px 20px 0 0';
        
        // Pause video when showing comments
        const video = card.querySelector('video');
        if(video) video.pause();
    } else {
        // Hide comments overlay
        commPanel.style.display = 'none';
        
        // Resume video
        const video = card.querySelector('video');
        if(video) video.play();
    }
}