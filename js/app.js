document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const loadingScreen = document.getElementById('loading-screen');
    const todoContainer = document.getElementById('todo-container');
    const btnLogout = document.getElementById('btn-logout');
    const userGreeting = document.getElementById('user-greeting');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Todo Elements
    const addTaskForm = document.getElementById('add-task-form');
    const taskListEl = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const fabAdd = document.getElementById('fab-add');
    
    // Controls Elements
    const searchInput = document.getElementById('search-input');
    const filterDateSelect = document.getElementById('filter-date');
    const sortSelect = document.getElementById('sort-select');

    // Modals
    const editModal = document.getElementById('edit-modal');
    const addModal = document.getElementById('add-modal');
    const closeEditBtn = document.querySelector('#edit-modal .close-modal');
    const closeAddBtn = document.querySelector('#add-modal .close-modal');
    const editTaskForm = document.getElementById('edit-task-form');

    // State
    let tasks = [];
    let currentFilter = 'all'; // status filter
    let dateFilter = 'all';
    let currentSort = 'due_date_asc';
    let searchQuery = '';
    let currentUser = null;

    // --- Helpers ---
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const DateUtils = {
        getLocalYMD: (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        parseLocal: (ymd) => {
            const [y, m, d] = ymd.split('-').map(Number);
            return new Date(y, m - 1, d).getTime();
        },
        formatDate: (dateStr) => {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('id-ID', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            });
        }
    };

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️';
        }
    });

    // --- Auth Check ---
    const initApp = async () => {
        if (!window.supabaseClient) {
            console.error('Supabase client belum siap saat initApp.');
            return;
        }
        const supabase = window.supabaseClient;

        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'auth.html';
            return;
        }

        currentUser = session.user;
        
        // UI Init
        loadingScreen.style.display = 'none';
        todoContainer.style.display = 'block';
        
        const userName = session.user.user_metadata?.name || session.user.email;
        userGreeting.textContent = `Halo, ${userName}!`;
        
        // Setup Logout
        btnLogout.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) window.location.href = 'auth.html';
        });

        // Initial Fetch
        fetchTasks(supabase);
        
        // Setup Realtime Subscription
        setupRealtimeSubscription(supabase);
    };

    if (window.supabaseClient) {
        initApp();
    } else {
        window.addEventListener('supabase:ready', initApp);
    }

    // --- Realtime Subscription ---
    const setupRealtimeSubscription = (supabase) => {
        supabase
            .channel('public:tasks')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'tasks',
                filter: `user_id=eq.${currentUser.id}` 
            }, (payload) => {
                handleRealtimeEvent(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Realtime subscription active');
                }
            });
    };

    const handleRealtimeEvent = (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT') {
            // Check if we already have this task (avoid duplicates from own actions)
            const exists = tasks.find(t => t.id === newRecord.id);
            if (!exists) {
                tasks.unshift(newRecord);
                renderTasks();
                showToast('Tugas baru diterima', 'info');
            }
        } else if (eventType === 'UPDATE') {
            const index = tasks.findIndex(t => t.id === newRecord.id);
            if (index > -1) {
                // Check if meaningful change occurred to avoid redundant toasts/renders for own actions
                // Comparing simple fields
                const current = tasks[index];
                if (current.title !== newRecord.title || 
                    current.status !== newRecord.status || 
                    current.description !== newRecord.description ||
                    current.priority !== newRecord.priority ||
                    JSON.stringify(current.tags) !== JSON.stringify(newRecord.tags)) {
                    
                    tasks[index] = { ...tasks[index], ...newRecord };
                    renderTasks();
                    showToast('Tugas diperbarui', 'info');
                }
            }
        } else if (eventType === 'DELETE') {
            const index = tasks.findIndex(t => t.id === oldRecord.id);
            if (index > -1) {
                tasks.splice(index, 1);
                renderTasks();
                showToast('Tugas dihapus', 'error');
            }
        }
    };

    // --- Toast Notification ---
    const showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    };

    // --- To-Do Logic ---

    // Fetch Tasks
    const fetchTasks = async (supabase) => {
        taskListEl.innerHTML = '<p style="text-align: center;">Memuat...</p>';
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching tasks:', error);
            taskListEl.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Gagal memuat tugas.</p>';
            return;
        }

        tasks = data || [];
        renderTasks();
    };

    // Render Tasks
    const renderTasks = () => {
        taskListEl.innerHTML = '';
        
        // 1. Filter Date
        let filtered = tasks.filter(task => {
            if (dateFilter === 'all') return true;
            if (!task.due_date) return false;

            const taskDateStr = task.due_date; // YYYY-MM-DD
            const localTodayStr = DateUtils.getLocalYMD(new Date());

            if (dateFilter === 'today') {
                return taskDateStr === localTodayStr;
            }
            
            if (dateFilter === 'week') {
                const taskTime = DateUtils.parseLocal(taskDateStr);
                const todayTime = DateUtils.parseLocal(localTodayStr);
                const nextWeekTime = todayTime + (7 * 24 * 60 * 60 * 1000);

                return taskTime >= todayTime && taskTime <= nextWeekTime;
            }
            
            if (dateFilter === 'month') {
                return taskDateStr.substring(0, 7) === localTodayStr.substring(0, 7);
            }
            return true;
        });

        // 2. Filter Status
        filtered = filtered.filter(task => {
            if (currentFilter === 'active') return task.status === 'active';
            if (currentFilter === 'completed') return task.status === 'completed';
            return true;
        });

        // 3. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(task => {
                const inTitle = task.title.toLowerCase().includes(q);
                const inDesc = task.description && task.description.toLowerCase().includes(q);
                const inTags = task.tags && task.tags.some(t => t.toLowerCase().includes(q));
                return inTitle || inDesc || inTags;
            });
        }

        // 4. Sort
        filtered.sort((a, b) => {
            if (currentSort === 'due_date_asc') {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            }
            if (currentSort === 'created_desc') {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            if (currentSort === 'priority_desc') {
                const pMap = { high: 3, medium: 2, low: 1 };
                return pMap[b.priority] - pMap[a.priority];
            }
            return 0;
        });

        if (filtered.length === 0) {
            taskListEl.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Tidak ada tugas yang cocok.</p>';
            return;
        }

        filtered.forEach(task => {
            const isCompleted = task.status === 'completed';
            const dateStr = DateUtils.formatDate(task.due_date);
            
            const card = document.createElement('div');
            card.className = `task-card ${isCompleted ? 'task-completed' : ''}`;
            
            // Tags HTML
            let tagsHtml = '';
            if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
                tagsHtml = `<div class="tags-container">
                    ${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>`;
            }

            // Description HTML
            const descHtml = task.description 
                ? `<div class="task-desc">${escapeHtml(task.description)}</div>` 
                : '';

            card.innerHTML = `
                <div class="task-header">
                    <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}>
                    <div class="task-content">
                        <div class="task-title">${escapeHtml(task.title)}</div>
                        ${descHtml}
                        <div class="task-meta">
                            <span class="badge badge-priority-${task.priority}">${task.priority}</span>
                            ${dateStr ? `<span class="task-date">📅 ${dateStr}</span>` : ''}
                        </div>
                        ${tagsHtml}
                    </div>
                    <div class="task-actions">
                        <button class="btn-edit" title="Edit">✏️</button>
                        <button class="btn-delete" title="Hapus">🗑️</button>
                    </div>
                </div>
            `;

            // Event Listeners
            const checkbox = card.querySelector('.task-checkbox');
            checkbox.addEventListener('change', () => toggleTask(task.id, task.status));

            const editBtn = card.querySelector('.btn-edit');
            editBtn.addEventListener('click', () => openEditModal(task));

            const deleteBtn = card.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            taskListEl.appendChild(card);
        });
    };

    // Add Task
    addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        const tagsStr = document.getElementById('task-tags').value.trim();
        const priority = document.getElementById('task-priority').value;
        const date = document.getElementById('task-date').value;
        const btnSubmit = addTaskForm.querySelector('button[type="submit"]');

        if (!title) return;

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menambahkan...';

        // Parse tags
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

        const newTask = {
            user_id: currentUser.id,
            title: title,
            description: desc || null,
            priority: priority,
            due_date: date || null,
            tags: tags,
            status: 'active'
        };

        const { data, error } = await window.supabaseClient
            .from('tasks')
            .insert([newTask])
            .select()
            .single();

        if (error) {
            console.error('Error adding task:', error);
            alert('Gagal menambah tugas.');
        } else {
            // tasks.unshift(data); // Handled by realtime
            addTaskForm.reset();
            closeAddModal();
        }
        
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Tambah Tugas';
    });

    // Update Task (Edit)
    editTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-task-id').value;
        const title = document.getElementById('edit-task-title').value.trim();
        const desc = document.getElementById('edit-task-desc').value.trim();
        const tagsStr = document.getElementById('edit-task-tags').value.trim();
        const priority = document.getElementById('edit-task-priority').value;
        const date = document.getElementById('edit-task-date').value;
        const btnSubmit = editTaskForm.querySelector('button[type="submit"]');

        if (!title) return;

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menyimpan...';

        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

        const updates = {
            title: title,
            description: desc || null,
            priority: priority,
            due_date: date || null,
            tags: tags,
            updated_at: new Date().toISOString()
        };

        // Optimistic Update
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
            renderTasks();
        }

        const { error } = await window.supabaseClient
            .from('tasks')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating task:', error);
            alert('Gagal menyimpan perubahan.');
            // Revert would be complex here, so we just re-fetch or let it be for now
        }
        
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Simpan Perubahan';
        closeModal();
    });

    // Toggle Task
    const toggleTask = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'completed' : 'active';
        
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasks[taskIndex].status = newStatus;
            renderTasks();
        }

        const { error } = await window.supabaseClient
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error updating task:', error);
            tasks[taskIndex].status = currentStatus;
            renderTasks();
        }
    };

    // Delete Task
    const deleteTask = async (id) => {
        if (!confirm('Hapus tugas ini?')) return;

        const taskIndex = tasks.findIndex(t => t.id === id);
        const originalTask = tasks[taskIndex];
        tasks.splice(taskIndex, 1);
        renderTasks();

        const { error } = await window.supabaseClient
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting task:', error);
            tasks.splice(taskIndex, 0, originalTask);
            renderTasks();
        }
    };

    // Modal Logic
    const openEditModal = (task) => {
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-desc').value = task.description || '';
        document.getElementById('edit-task-tags').value = task.tags ? task.tags.join(', ') : '';
        document.getElementById('edit-task-priority').value = task.priority;
        document.getElementById('edit-task-date').value = task.due_date || '';
        
        editModal.classList.add('show');
    };

    const openAddModal = () => {
        addModal.classList.add('show');
        // Auto focus title
        setTimeout(() => document.getElementById('task-title').focus(), 100);
    };

    const closeModal = () => {
        editModal.classList.remove('show');
    };

    const closeAddModal = () => {
        addModal.classList.remove('show');
    };

    // Event Listeners for Modals
    fabAdd.addEventListener('click', openAddModal);
    
    closeEditBtn.addEventListener('click', closeModal);
    closeAddBtn.addEventListener('click', closeAddModal);

    window.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
        if (e.target === addModal) closeAddModal();
    });

    // Filters & Controls
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderTasks();
        });
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderTasks();
    });

    filterDateSelect.addEventListener('change', (e) => {
        dateFilter = e.target.value;
        renderTasks();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderTasks();
    });

    // Print Logic
    const btnExportPdf = document.getElementById('btn-export-pdf');
    
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            const printArea = document.getElementById('print-area');
            if (!printArea) return;

            // Generate content
            const dateStr = new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const userName = currentUser.user_metadata?.name || currentUser.email;

            let tableRows = '';
            
            // Use current 'tasks' state (contains all fetched tasks)
            // Sort by due date (default for report) or keep current sort? 
            // User asked for "Export mencakup semua task user", usually implies a report.
            // Let's sort by Due Date Ascending for better readability in report.
            const sortedTasks = [...tasks].sort((a, b) => {
                 // Null dates last
                 if (!a.due_date) return 1;
                 if (!b.due_date) return -1;
                 return new Date(a.due_date) - new Date(b.due_date);
            });

            // Calculate Stats
            const totalTasks = sortedTasks.length;
            const completedTasks = sortedTasks.filter(t => t.status === 'completed').length;
            const activeTasks = sortedTasks.filter(t => t.status === 'active').length;
            
            // Calculate Overdue
            const todayStr = DateUtils.getLocalYMD(new Date());
            const overdueTasks = sortedTasks.filter(t => {
                if (t.status === 'completed' || !t.due_date) return false;
                return t.due_date < todayStr;
            }).length;

            // Calculate Completion Rate
            const completionRate = totalTasks > 0 
                ? Math.round((completedTasks / totalTasks) * 100) 
                : 0;

            if (sortedTasks.length === 0) {
                tableRows = '<tr><td colspan="5" style="text-align:center">Tidak ada tugas.</td></tr>';
            } else {
                sortedTasks.forEach((task, index) => {
                    const statusClass = task.status === 'active' ? 'status-active' : 'status-completed';
                    const priorityClass = `priority-${task.priority}`;
                    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID') : '-';
                    const statusLabel = task.status === 'active' ? 'Aktif' : 'Selesai';
                    
                    // Highlight overdue in table if active
                    const isOverdue = task.status === 'active' && task.due_date && task.due_date < todayStr;
                    const dateStyle = isOverdue ? 'color: var(--danger-color); font-weight: bold;' : '';
                    const dateDisplay = isOverdue ? `${dueDate} (Terlambat)` : dueDate;

                    tableRows += `
                        <tr>
                            <td style="text-align:center">${index + 1}</td>
                            <td>
                                <strong>${escapeHtml(task.title)}</strong>
                                ${task.description ? `<br><small>${escapeHtml(task.description)}</small>` : ''}
                            </td>
                            <td style="${dateStyle}">${dateDisplay}</td>
                            <td class="${priorityClass}" style="text-transform:capitalize">${task.priority}</td>
                            <td class="${statusClass}">${statusLabel}</td>
                        </tr>
                    `;
                });
            }

            printArea.innerHTML = `
                <div class="print-header">
                    <h1>Laporan Tugas</h1>
                    <p class="print-date">
                        User: <strong>${escapeHtml(userName)}</strong><br>
                        Dicetak pada: ${dateStr}
                    </p>
                    
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Total Tugas</span>
                            <span class="stat-value">${totalTasks}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Selesai</span>
                            <span class="stat-value text-success">${completedTasks}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Pending</span>
                            <span class="stat-value text-warning">${activeTasks}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Terlambat</span>
                            <span class="stat-value text-danger">${overdueTasks}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Penyelesaian</span>
                            <span class="stat-value">${completionRate}%</span>
                        </div>
                    </div>
                </div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th style="width: 5%">No</th>
                            <th style="width: 45%">Tugas & Deskripsi</th>
                            <th style="width: 15%">Tenggat</th>
                            <th style="width: 15%">Prioritas</th>
                            <th style="width: 20%">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            // Trigger print
            window.print();
        });
    }
});
