// Wait for document and Firebase to be fully loaded
document.addEventListener("DOMContentLoaded", function() {
    console.log("Document loaded!");
    
    // DOM elements
    const waitingRoom = document.getElementById('waiting-room');
    const gameArea = document.getElementById('game-area');
    const statusMessage = document.getElementById('status-message');
    const dots = document.querySelector('.dots');
    const enterButton = document.getElementById('enter-button');
    const canvasContainer = document.getElementById('canvas-container');
    const partnerCursor = document.createElement('img');
    partnerCursor.id = 'partner-cursor';
    partnerCursor.src = 'cursor.svg';
    partnerCursor.alt = '';
    canvasContainer.appendChild(partnerCursor);
    
    // Animation for the dots
    let dotsInterval = setInterval(() => {
        if (dots) {
            if (dots.textContent === '.') dots.textContent = '..';
            else if (dots.textContent === '..') dots.textContent = '...';
            else dots.textContent = '.';
        }
    }, 500);
    
    // App state
    let userId;
    let roomId = null;
    let partnerId = null;
    let currentEpisode = 'opening';
    let isReady = false;
    let lastCursorUpdate = 0;

    document.getElementById('episode-title').textContent = "Sisters: Opening";

    
    // Initialize the app once Firebase is ready
    setTimeout(initApp, 500);
    
    function initApp() {
        if (!window.database) {
            console.log("Waiting for Firebase...");
            setTimeout(initApp, 500);
            return;
        }
        
        console.log("Starting app initialization...");
        
        // Generate a unique ID for this user
        userId = 'user_' + Date.now().toString();
        console.log("Generated user ID:", userId);
        
        // Create references to the database
        const database = window.database;
        const usersRef = window.dbRef(database, 'users');
        const userRef = window.dbRef(database, 'users/' + userId);
        const roomsRef = window.dbRef(database, 'rooms');
        
        // Add user to the database
        window.dbSet(userRef, {
            status: 'waiting',
            timestamp: Date.now()
        }).then(() => {
            console.log("User added to database!");
            
            // Clean up user data when they disconnect
            window.dbOnDisconnect(userRef).remove();
            
            // Start the matching process
            findMatch(database, usersRef, userRef, roomsRef);
        }).catch((error) => {
            console.error("Error adding user:", error);
        });
    }
    
    // Function to find a match for this user
    function findMatch(database, usersRef, userRef, roomsRef) {
        console.log("Looking for a match...");
        
        // Get a list of waiting users
        window.dbOnValue(usersRef, (snapshot) => {
            const users = snapshot.val();
            if (!users) return;
            
            // Filter out our own ID and users who are already paired
            const waitingUsers = Object.entries(users)
                .filter(([id, data]) => id !== userId && data.status === 'waiting')
                .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp
            
            console.log("Found waiting users:", waitingUsers.length);
            
            if (waitingUsers.length > 0) {
                // Get the first waiting user
                const [matchedPartnerId, partnerData] = waitingUsers[0];
                partnerId = matchedPartnerId;
                
                // Create a new room
                const newRoomRef = window.dbPush(roomsRef);
                roomId = newRoomRef.key;
                
                // Update both users with room ID
                const updates = {};
                updates[`users/${userId}/status`] = 'paired';
                updates[`users/${userId}/roomId`] = roomId;
                updates[`users/${partnerId}/status`] = 'paired';
                updates[`users/${partnerId}/roomId`] = roomId;
                
                // Initialize room data
                updates[`rooms/${roomId}/users`] = {
                    [userId]: { status: 'paired', ready: false },
                    [partnerId]: { status: 'paired', ready: false }
                };
                updates[`rooms/${roomId}/createdAt`] = Date.now();
                updates[`rooms/${roomId}/currentEpisode`] = 'opening';
                
                // Initialize episode 1 window data - pre-populate with 5 windows, none clicked yet
                updates[`rooms/${roomId}/episodes/episode1/windows/0`] = { isOff: false };
                updates[`rooms/${roomId}/episodes/episode1/windows/1`] = { isOff: false };
                updates[`rooms/${roomId}/episodes/episode1/windows/2`] = { isOff: false };
                updates[`rooms/${roomId}/episodes/episode1/windows/3`] = { isOff: false };
                updates[`rooms/${roomId}/episodes/episode1/windows/4`] = { isOff: false };
                
                // Apply all updates atomically
                window.dbUpdate(window.dbRef(database), updates)
                    .then(() => {
                        console.log("Room created with partner:", partnerId);
                        setupPartnerConnection(database, roomId, partnerId);
                    })
                    .catch((error) => {
                        console.error("Error creating room:", error);
                    });
            } else {
                // No partner found, let's wait for someone to join
                console.log("No partners available, waiting...");
                
                // Listen for our own user data changes (room assignment)
                window.dbOnValue(userRef, (snapshot) => {
                    const userData = snapshot.val();
                    if (!userData) return;
                    
                    // Check if we've been assigned to a room
                    if (userData.roomId && userData.status === 'paired') {
                        roomId = userData.roomId;
                        
                        // Find our partner
                        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/users`), (snapshot) => {
                            const users = snapshot.val();
                            if (!users) return;
                            
                            // Find the other user in the room
                            partnerId = Object.keys(users).find(id => id !== userId);
                            
                            if (partnerId) {
                                console.log("We were paired with:", partnerId);
                                setupPartnerConnection(database, roomId, partnerId);
                            }
                        }, { onlyOnce: true });
                    }
                });
            }
        }, { onlyOnce: true });
    }
    
    // Set up connection with partner
    function setupPartnerConnection(database, roomId, partnerId) {

        // Hide the status container instead of changing text
        document.querySelector('.status-container').classList.add('hidden');
        
        // Show enter button
        enterButton.classList.remove('hidden');
        
        // Handle enter button click
        enterButton.addEventListener('click', () => {
            // Mark this user as ready
            window.dbSet(window.dbRef(database, `rooms/${roomId}/users/${userId}/ready`), true);
            
            // Change button text to "Ready"
            enterButton.textContent = "Ready";
            enterButton.disabled = true;
            
            // Set local ready state
            isReady = true;
            
            // Check if both users are ready
            checkBothReady(database, roomId, partnerId);
        });
        
        // Listen for partner's ready status
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/users/${partnerId}/ready`), (snapshot) => {
            const isPartnerReady = snapshot.val();
            
            if (isPartnerReady && isReady) {
                // Both users are ready, move to first episode
                startEpisode(database, roomId, partnerId, 'episode1');
            }
        });
        
        // Track cursor movements
        setupCursorTracking(database, roomId, partnerId);
    }
    
    // Check if both users are ready
    function checkBothReady(database, roomId, partnerId) {
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/users/${partnerId}/ready`), (snapshot) => {
            const isPartnerReady = snapshot.val();
            
            if (isPartnerReady && isReady) {
                // Both users are ready, move to first episode
                startEpisode(database, roomId, partnerId, 'episode1');
            }
        }, { onlyOnce: true });
    }
    
    // Start a specific episode
    function startEpisode(database, roomId, partnerId, episode) {
        currentEpisode = episode;
        
        // Update current episode in database
        window.dbSet(window.dbRef(database, `rooms/${roomId}/currentEpisode`), episode);
        
        // Hide waiting room and show game area
        waitingRoom.classList.add('hidden');
        gameArea.classList.remove('hidden');
        
        // Clear canvas container
        canvasContainer.innerHTML = '';
        
        // Add partner cursor back (except for ending credits)
        if (episode !== 'ending') {
            canvasContainer.appendChild(partnerCursor);
        }
        
        // Update episode title
        if (episode === 'episode1') {
            document.getElementById('episode-title').textContent = "Sisters: ep1.The Light";
        } else if (episode === 'episode2') {
            document.getElementById('episode-title').textContent = "Sisters: ep2.The Tissue";
        } else if (episode === 'ending') {
            document.getElementById('episode-title').textContent = "Sisters: The End";
        } else {
            document.getElementById('episode-title').textContent = "Sisters: Opening";
        }
        
        // Set up the appropriate episode
        if (episode === 'episode1') {
            setupEpisode1(database, roomId, partnerId);
        } else if (episode === 'episode2') {
            setupEpisode2(database, roomId, partnerId);
        } else if (episode === 'ending') {
            setupEndingCredits(database, roomId, partnerId);
        }
    }
    
    // Set up episode 1 - The Light
    function setupEpisode1(database, roomId, partnerId) {
        // Create house structure
        const house = document.createElement('div');
        house.className = 'house';
        
        // Create roof
        const roof = document.createElement('div');
        roof.className = 'roof';
        house.appendChild(roof);
        
        // Create windows (5 windows with lights on)
        const windowPositions = [
            { top: '35%', left: '15%' },
            { top: '35%', left: '45%' },
            { top: '35%', left: '75%' },
            { top: '65%', left: '45%' },
            { top: '65%', left: '75%' }
        ];
        
        windowPositions.forEach((pos, index) => {
            const window = document.createElement('div');
            window.className = 'window on';  // Start with light on
            window.style.top = pos.top;
            window.style.left = pos.left;
            window.dataset.index = index;
            
            // Add click event handler
            window.addEventListener('click', () => {
                handleWindowClick(database, roomId, partnerId, index, window);
            });
            
            house.appendChild(window);
        });
        
        // Create door
        const door = document.createElement('div');
        door.className = 'door';
        door.style.left = '15%';
        door.style.bottom = '0';
        house.appendChild(door);
        
        // Create task instruction
        const instruction = document.createElement('div');
        instruction.id = 'task-instruction';
        instruction.textContent = "- Kids turn off the light";
        instruction.style.position = 'absolute';
        instruction.style.bottom = '4%';
        instruction.style.left = '50%';
        instruction.style.transform = 'translateX(-50%)';
        instruction.style.color = '#ff0';
        instruction.style.fontSize = '2rem';
        house.appendChild(instruction);
        
        canvasContainer.appendChild(house);
        
        // Listen for window state changes
        listenForWindowChanges(database, roomId, partnerId);
    }
    
    // Handle window click
    function handleWindowClick(database, roomId, partnerId, windowIndex, windowElement) {
        const windowRef = window.dbRef(database, `rooms/${roomId}/episodes/episode1/windows/${windowIndex}`);
        
        // Get current window state
        window.dbOnValue(windowRef, (snapshot) => {
            const windowData = snapshot.val() || {};
            
            // If window is already off, do nothing
            if (windowData.isOff) return;
            
            // Record this user's click
            const updates = {};
            updates[userId] = true;
            
            // Update the window data
            window.dbUpdate(windowRef, updates);
            
            // Check if both users have clicked
            if (windowData[partnerId]) {
                // Both users have clicked, mark as off
                window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode1/windows/${windowIndex}/isOff`), true);
            }
        }, { onlyOnce: true });
    }
    
    // Listen for window state changes
    function listenForWindowChanges(database, roomId, partnerId) {
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode1/windows`), (snapshot) => {
            const windowsData = snapshot.val();
            if (!windowsData) return;
            
            // Count how many windows are off
            let windowsOff = 0;
            const totalWindows = 5;
            
            // Update window states based on database
            for (let i = 0; i < totalWindows; i++) {
                const windowData = windowsData[i];
                const windowElement = document.querySelector(`.window[data-index="${i}"]`);
                
                if (windowElement && windowData && windowData.isOff) {
                    windowElement.classList.remove('on');
                    windowsOff++;
                } else if (windowElement) {
                    windowElement.classList.add('on');
                }
            }
            
            // Check if all windows are turned off
            if (windowsOff === totalWindows) {
                // All windows are off!
                const instruction = document.getElementById('task-instruction');
                if (instruction) {
                    instruction.textContent = "- Good girls! Sweet dreams my loves";
                }
                
                // Display success message
                const successMessage = document.createElement('div');
                successMessage.id = 'success';
                successMessage.textContent = "Moving to next episode...";
                successMessage.style.position = 'absolute';
                successMessage.style.top = '50%';
                successMessage.style.left = '50%';
                successMessage.style.transform = 'translate(-50%, -50%)';
                successMessage.style.color = '#F6FD55';
                successMessage.style.fontSize = '2rem';
                successMessage.style.backgroundColor = 'rgba(58, 58, 58, 0.80)';
                successMessage.style.padding = '20px';                
                canvasContainer.appendChild(successMessage);
                
                // Move to next episode after a delay
                setTimeout(() => {
                    // Move to episode 2 instead of resetting
                    startEpisode(database, roomId, partnerId, 'episode2');
                }, 3000);
            }
        });
    }
    
    // Set up episode 2 - The Tissue
    function setupEpisode2(database, roomId, partnerId) {
        // Create main container
        const scene = document.createElement('div');
        scene.className = 'tissue-scene';
        
        // Create tissue box
        const tissueBox = document.createElement('div');
        tissueBox.className = 'tissue-box';
        scene.appendChild(tissueBox);
        
        // Create tissue
        const tissue = document.createElement('div');
        tissue.className = 'tissue';
        tissue.id = 'tissue';
        tissueBox.appendChild(tissue);
        
        // Create task instruction
        const instruction = document.createElement('div');
        instruction.id = 'task-instruction';
        instruction.textContent = "- Kids pass me the tissue please";
        instruction.style.position = 'absolute';
        instruction.style.bottom = '4%';
        instruction.style.left = '50%';
        instruction.style.transform = 'translateX(-50%)';
        instruction.style.color = '#ff0';
        instruction.style.fontSize = '2rem';
        scene.appendChild(instruction);
        
        canvasContainer.appendChild(scene);
        
        // Set up tissue interaction
        setupTissueInteraction(database, roomId, partnerId, tissue);
    }
    
    // Set up tissue interaction
    function setupTissueInteraction(database, roomId, partnerId, tissueElement) {
        let isDragging = false;
        let bothUsersClicking = false;
        let tissueProgress = 0;
        let isCompleted = false;
        
        // Create progress tracking in Firebase
        window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2`), {
            userClicks: {
                [userId]: false,
                [partnerId]: false
            },
            tissueProgress: 0,
            isCompleted: false
        });
        
        // Handle mouse down on tissue
        tissueElement.addEventListener('mousedown', (e) => {
            // If task already completed, do nothing
            window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode2/isCompleted`), (snapshot) => {
                const completed = snapshot.val();
                if (completed) {
                    isCompleted = true;
                    return;
                }
                
                // Record user click in database
                window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2/userClicks/${userId}`), true);
                
                // Check if both users are clicking
                window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode2/userClicks/${partnerId}`), (snapshot) => {
                    const partnerClicking = snapshot.val();
                    if (partnerClicking) {
                        bothUsersClicking = true;
                        isDragging = true;
                    }
                });
            });
        });
        
        // Handle mouse up
        document.addEventListener('mouseup', () => {
            // If task already completed, do nothing
            if (isCompleted) return;
            
            isDragging = false;
            bothUsersClicking = false;
            
            // Reset user click in database
            window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2/userClicks/${userId}`), false);
        });
        
        // Handle mouse move for dragging tissue
        canvasContainer.addEventListener('mousemove', (e) => {
            // If task already completed, do nothing
            if (isCompleted) return;
            
            if (isDragging && bothUsersClicking) {
                // Calculate new position based on mouse movement
                tissueProgress += 0.5;  // Increment progress
                
                // Limit progress to 100
                if (tissueProgress > 100) {
                    tissueProgress = 100;
                    isCompleted = true;
                    
                    // Mark as completed in database to prevent further interactions
                    window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2/isCompleted`), true);
                }
                
                // Update progress in database
                window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2/tissueProgress`), tissueProgress);
            }
        });
        
        // Listen for changes in tissue progress from either user
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode2/tissueProgress`), (snapshot) => {
            const progress = snapshot.val();
            if (progress !== null) {
                tissueProgress = progress;
                updateTissuePosition(tissueElement, progress);
                
                // Check if task is complete (tissue fully pulled out)
                if (progress >= 100 && !isCompleted) {
                    isCompleted = true;
                    // Mark as completed in database
                    window.dbSet(window.dbRef(database, `rooms/${roomId}/episodes/episode2/isCompleted`), true);
                    // Show completion
                    taskComplete(database, roomId, partnerId);
                }
            }
        });
        
        // Listen for completion state
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode2/isCompleted`), (snapshot) => {
            const completed = snapshot.val();
            if (completed) {
                isCompleted = true;
            }
        });
        
        // Listen for partner's click state
        window.dbOnValue(window.dbRef(database, `rooms/${roomId}/episodes/episode2/userClicks/${partnerId}`), (snapshot) => {
            const partnerClicking = snapshot.val();
            // Only update if not completed
            if (!isCompleted) {
                if (isDragging && partnerClicking) {
                    bothUsersClicking = true;
                } else {
                    bothUsersClicking = false;
                }
            }
        });
    }
    
    // Update tissue position based on progress
    function updateTissuePosition(tissueElement, progress) {
        // Calculate how far the tissue should extend from the box
        const maxExtension = 150;  // Max pixels to extend
        const extension = (progress / 100) * maxExtension;
        
        // Update the tissue element position
        tissueElement.style.height = `${100 + extension}px`;
        tissueElement.style.top = `${-extension}px`;
    }
    
    // Display success message when task is complete
    function taskComplete(database, roomId, partnerId) {
        // Change instruction text
        const instruction = document.getElementById('task-instruction');
        if (instruction) {
            instruction.textContent = "- Thank you my loves!";
        }
        
        // Display success message
        const successMessage = document.createElement('div');
        successMessage.id = 'success';
        successMessage.textContent = "Moving to next episode...";
        successMessage.style.position = 'absolute';
        successMessage.style.top = '50%';
        successMessage.style.left = '50%';
        successMessage.style.transform = 'translate(-50%, -50%)';
        successMessage.style.color = '#F6FD55';
        successMessage.style.fontSize = '2rem';
        successMessage.style.backgroundColor = 'rgba(58, 58, 58, 0.80)';
        successMessage.style.padding = '20px';                
        canvasContainer.appendChild(successMessage);
        
        // Move to ending credits after a delay
        setTimeout(() => {
            // Go to ending credits
            startEpisode(database, roomId, partnerId, 'ending');
        }, 3000);
    }
    
    // Set up ending credits
    function setupEndingCredits(database, roomId, partnerId) {
        // Create ending screen container
        const endingScreen = document.createElement('div');
        endingScreen.className = 'ending-screen';
        
        // Create ending content
        const endTitle = document.createElement('h1');
        endTitle.className = 'end-title';
        endTitle.textContent = 'The End';
        
        // Create start again button
        const startAgainBtn = document.createElement('button');
        startAgainBtn.id = 'start-again-btn';
        startAgainBtn.textContent = 'Start again';
        startAgainBtn.addEventListener('click', () => {
            // Reset to opening
            window.location.reload(); // Simple method to restart the experience
        });
        
        // Add elements to container
        endingScreen.appendChild(endTitle);
        endingScreen.appendChild(startAgainBtn);
        
        // Add to canvas container
        canvasContainer.appendChild(endingScreen);
        
        // Update episode title
        document.getElementById('episode-title').textContent = "Sisters: The End";
    }
    
    // Reset episode 1 for testing
    function resetEpisode1(database, roomId, partnerId) {
        // Reset all windows to on
        const updates = {};
        for (let i = 0; i < 5; i++) {
            updates[`rooms/${roomId}/episodes/episode1/windows/${i}`] = { isOff: false };
        }
        
        // Apply updates
        window.dbUpdate(window.dbRef(database), updates)
            .then(() => {
                console.log("Episode 1 reset");
                setupEpisode1(database, roomId, partnerId);
            })
            .catch((error) => {
                console.error("Error resetting episode 1:", error);
            });
    }
    
    // Function to set up cursor tracking (with optimization)
    function setupCursorTracking(database, roomId, partnerId) {
        console.log("Setting up cursor tracking...");
        
        // Track our own cursor movements (throttled to reduce database writes)
        canvasContainer.addEventListener('mousemove', (e) => {
            const now = Date.now();
            
            // Only update cursor every 50ms (20 times per second) to reduce lag
            if (now - lastCursorUpdate > 50) {
                lastCursorUpdate = now;
                
                // Get position relative to canvas container
                const rect = canvasContainer.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                
                // Update our cursor position in database (using percentages for responsive positioning)
                window.dbSet(window.dbRef(database, `users/${userId}/cursor`), {
                    x: x,
                    y: y
                });
            }
        });
        
        // Track partner's cursor movements
        window.dbOnValue(window.dbRef(database, `users/${partnerId}/cursor`), (snapshot) => {
            const cursorData = snapshot.val();
            if (!cursorData) return;
            
            // Update partner cursor position (converting from percentages)
            partnerCursor.style.display = 'block';
            partnerCursor.style.left = `${cursorData.x}%`;
            partnerCursor.style.top = `${cursorData.y}%`;
        });
    }
});