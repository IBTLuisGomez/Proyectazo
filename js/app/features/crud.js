'use strict';
// Checkout, captura rápida y altas/ediciones de proyectos, pensamientos y tareas.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // PROTOCOLO DE CIERRE (CHECKOUT)
  // ==========================================
  openCheckout(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    document.getElementById('checkout-project-id').value = p.id;
    document.getElementById('checkout-project-badge').textContent = `${p.emoji || '🎯'} ${p.name}`;
    document.getElementById('checkout-achievement').value = '';
    document.getElementById('checkout-next-action').value = p.nextAction || '';
    document.getElementById('checkout-action-type').value = p.nextActionType || 'hacer';
    document.getElementById('checkout-energy').value = p.energy || 'media';

    document.querySelectorAll('input[name="checkout-status"]').forEach(r => {
      r.checked = (r.value === p.status);
    });

    this.openModal('modal-checkout');
  },

  submitCheckout(e) {
    e.preventDefault();
    const projectId = document.getElementById('checkout-project-id').value;
    const achievement = document.getElementById('checkout-achievement').value.trim();
    const nextAction = document.getElementById('checkout-next-action').value.trim();
    const actionType = document.getElementById('checkout-action-type').value;
    const energy = document.getElementById('checkout-energy').value;
    const status = document.querySelector('input[name="checkout-status"]:checked').value;

    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    const newLog = {
      id: this.uid(),
      date: new Date().toISOString(),
      achievement: achievement,
      nextStep: nextAction,
      energy: energy,
      duration: 25
    };

    if (!p.logs) p.logs = [];
    p.logs.unshift(newLog);

    p.nextAction = nextAction;
    p.nextActionType = actionType;
    p.energy = energy;
    p.status = status;
    p.lastActivity = new Date().toISOString();

    this.saveState();
    this.closeModal('modal-checkout');
    this.triggerDopamineReward();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projectId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement: achievement,
          nextStep: nextAction,
          nextActionType: actionType,
          energy: energy,
          status: status,
          duration: 25
        })
      }).catch(() => {});
    }
  },

  // ==========================================
  // QUICK CAPTURE MODAL
  // ==========================================
  openQuickCapture() {
    const targetSelect = document.getElementById('quick-capture-target');
    if (targetSelect) {
      targetSelect.innerHTML = `
        <option value="pensadero">🧠 El Pensadero (descarga mental)</option>
        ${(this.state.projects || []).map(p => `
          <option value="${p.id}">🎯 Tarea en: ${p.emoji || '🎯'} ${this.escapeHtml(p.name)}</option>
        `).join('')}
      `;
    }
    document.getElementById('quick-capture-text').value = '';
    this.openModal('modal-quick-capture');
    setTimeout(() => document.getElementById('quick-capture-text').focus(), 100);
  },

  submitQuickCapture(e) {
    e.preventDefault();
    const text = document.getElementById('quick-capture-text').value.trim();
    const target = document.getElementById('quick-capture-target').value;
    if (!text) return;

    if (target === 'pensadero') {
      // Antes guardaba category: 'chispa', que no existe en la paleta
      this.captureThought(text, { source: 'captura-rapida' });
    } else {
      const p = this.state.projects.find(x => x.id === target);
      if (p) {
        if (!p.tasks) p.tasks = [];
        const task = {
          id: this.uid(),
          title: text,
          column: 'buzon',
          effort: 'S',
          createdAt: new Date().toISOString()
        };
        p.tasks.unshift(task);

        if (this.backendAvailable) {
          fetch(`${this.API_BASE}/projects/${target}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
          }).catch(() => {});
        }
      }
    }

    this.saveState();
    this.closeModal('modal-quick-capture');
    this.render();
  },

  // ==========================================
  // PROJECT CRUD
  // ==========================================
  openProjectModal(projectId = null) {
    const titleEl = document.getElementById('project-modal-title');
    const deleteBtn = document.getElementById('btn-delete-project');

    if (projectId) {
      const p = this.state.projects.find(x => x.id === projectId);
      if (!p) return;
      titleEl.textContent = 'Editar Proyecto';
      document.getElementById('project-form-id').value = p.id;
      document.getElementById('project-form-emoji').value = p.emoji || '⚡';
      document.getElementById('project-form-name').value = p.name || '';
      document.getElementById('project-form-objective').value = p.objective || '';
      document.getElementById('project-form-description').value = p.description || '';
      document.getElementById('project-form-next-action').value = p.nextAction || '';
      document.getElementById('project-form-keywords').value = p.keywords || '';
      document.getElementById('project-form-status').value = p.status || 'activo';
      document.getElementById('project-form-energy').value = p.energy || 'media';
      this.selectProjectColor(p.color || '#10b981');
      deleteBtn.classList.remove('hidden');
    } else {
      titleEl.textContent = 'Nuevo Proyecto';
      document.getElementById('project-form-id').value = '';
      document.getElementById('project-form-emoji').value = '⚡';
      document.getElementById('project-form-name').value = '';
      document.getElementById('project-form-objective').value = '';
      document.getElementById('project-form-description').value = '';
      document.getElementById('project-form-next-action').value = '';
      document.getElementById('project-form-keywords').value = '';
      document.getElementById('project-form-status').value = 'activo';
      document.getElementById('project-form-energy').value = 'media';
      this.selectProjectColor('#10b981');
      deleteBtn.classList.add('hidden');
    }

    this.updateProjectFormPreview();
    this.openModal('modal-project');
    // Editar: el cursor va al nombre, que es lo que más se cambia
    if (projectId) setTimeout(() => document.getElementById('project-form-name')?.focus(), 80);
  },

  submitProjectForm(e) {
    e.preventDefault();
    const id = document.getElementById('project-form-id').value;
    const emoji = document.getElementById('project-form-emoji').value.trim() || '⚡';
    const name = document.getElementById('project-form-name').value.trim();
    const color = document.getElementById('project-form-color').value;
    const objective = document.getElementById('project-form-objective').value.trim();
    const description = document.getElementById('project-form-description').value.trim();
    const nextAction = document.getElementById('project-form-next-action').value.trim() || 'Definir primera micro-acción';
    const status = document.getElementById('project-form-status').value;
    const energy = document.getElementById('project-form-energy').value;
    const keywords = document.getElementById('project-form-keywords').value
      .split(',').map(k => k.trim()).filter(Boolean).join(', ');

    // Límite TDAH: Máximo 3 proyectos "en_ejecucion" simultáneamente
    if (status === 'en_ejecucion') {
      const currentExecution = (this.state.projects || []).filter(p => p.status === 'en_ejecucion' && p.id !== id);
      if (currentExecution.length >= 3) {
        alert('⚠️ Límite TDAH: Máximo 3 proyectos En Ejecución simultáneos.\n\nPara proteger tu cerebro de la dispersión, FocusFlow OS limita los proyectos en ejecución inmediata a 3.\n\nPasa uno de tus proyectos a "Activo (En Radar)" o a "Incubadora" antes de poner este en ejecución.');
        return;
      }
    }

    if (id) {
      const p = this.state.projects.find(x => x.id === id);
      if (p) {
        p.emoji = emoji;
        p.name = name;
        p.color = color;
        p.objective = objective;
        p.description = description;
        p.nextAction = nextAction;
        p.updatedAt = new Date().toISOString();
        p.status = status;
        p.energy = energy;
        p.keywords = keywords;

        if (this.backendAvailable) {
          fetch(`${this.API_BASE}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          }).catch(() => {});
        }
      }
    } else {
      const newProject = {
        id: this.uid(),
        name: name,
        emoji: emoji,
        color: color,
        objective: objective,
        description: description,
        nextAction: nextAction,
        nextActionType: 'hacer',
        status: status,
        energy: energy,
        keywords: keywords,
        lastActivity: new Date().toISOString(),
        logs: [],
        tasks: [
          { id: this.uid(), title: nextAction, column: 'proximo', effort: 'S', createdAt: new Date().toISOString() }
        ]
      };
      this.state.projects.unshift(newProject);

      if (this.backendAvailable) {
        fetch(`${this.API_BASE}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProject)
        }).catch(() => {});
      }
    }

    this.saveState();
    this.closeModal('modal-project');
    this.render();
    this.showToast(id ? `✓ ${emoji} ${name} actualizado` : `✓ ${emoji} ${name} creado`);
  },

  deleteCurrentProject() {
    const id = document.getElementById('project-form-id').value;
    if (!id) return;
    if (this.deleteProject(id)) this.closeModal('modal-project');
  },

  // También lo usa el botón 🗑️ de los proyectos del Baúl
  deleteProject(id) {
    const p = (this.state.projects || []).find(x => x.id === id);
    if (!p) return false;
    if (!confirm(`¿Seguro que deseas eliminar "${p.name}" y todo su historial?`)) return false;
    this.state.projects = this.state.projects.filter(x => x.id !== id);
    this.saveState();
    this.render();

    this.deleteOnServer('project', id); // encola si no hay red
    return true;
  },

  // ==========================================
  // GESTIÓN DE EJECUCIÓN VS ACTIVO (MÁX 3 EJECUCIÓN)
  // ==========================================
  promoteToEjecucion(projectId) {
    const enEjecucion = (this.state.projects || []).filter(p => p.status === 'en_ejecucion');
    if (enEjecucion.length >= 3) {
      this.showToast('⚠️ Límite TDAH: Ya tienes 3 proyectos en ejecución. Pasa uno a Activo o Incubadora primero.');
      return;
    }
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p) {
      p.status = 'en_ejecucion';
      this.saveState();
      this.render();
      this.showToast(`🔥 ${p.name} ahora está En Ejecución Inmediata`);
    }
  },

  demoteToActivo(projectId) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p) {
      p.status = 'activo';
      this.saveState();
      this.render();
      this.showToast(`⚡ ${p.name} ahora está en el Radar Activo`);
    }
  },

  // ==========================================
  // PENSADERO CRUD (EDITAR / BORRAR PENSAMIENTOS)
  // ==========================================
  openEditThoughtModal(id) {
    const item = this.getPensaderoItem(id);
    if (!item) return;

    document.getElementById('edit-thought-id').value = item.id;
    document.getElementById('edit-thought-content').value = item.content || '';
    document.getElementById('edit-thought-category').value = item.category || 'humo_general';
    document.getElementById('edit-thought-weight').value = item.cognitiveWeight || 'medio';
    document.getElementById('edit-thought-contact').value = item.contactName || '';
    document.getElementById('edit-thought-amount').value = item.amount || '';
    document.getElementById('edit-thought-pinned').checked = !!item.isPinned;
    document.getElementById('edit-thought-resolved').checked = !!item.isResolved;

    this.openModal('modal-edit-thought');
  },

  saveThoughtEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-thought-id').value;
    const content = document.getElementById('edit-thought-content').value.trim();
    const category = document.getElementById('edit-thought-category').value;
    const weight = document.getElementById('edit-thought-weight').value;
    const contact = document.getElementById('edit-thought-contact').value.trim();
    const amount = document.getElementById('edit-thought-amount').value.trim();
    const isPinned = document.getElementById('edit-thought-pinned').checked;
    const isResolved = document.getElementById('edit-thought-resolved').checked;

    if (!content) return;

    const item = this.getPensaderoItem(id);
    if (item) {
      item.content = content;
      item.category = category;
      item.cognitiveWeight = weight;
      item.contactName = contact || null;
      item.amount = amount || null;
      item.isPinned = isPinned;
      item.isResolved = isResolved;
      item.updatedAt = new Date().toISOString();

      this.saveState();
      this.closeModal('modal-edit-thought');
      this.showToast('✓ Pensamiento actualizado');
      this.render();
    }
  },

  deletePensaderoFromEditModal() {
    const id = document.getElementById('edit-thought-id').value;
    if (!id) return;
    this.closeModal('modal-edit-thought');
    this.deletePensaderoItem(id);
  },

  // ==========================================
  // TASK CRUD (CREAR / EDITAR / BORRAR TAREAS)
  // ==========================================
  openCreateTaskModal(projectId = null, columnKey = 'proximo') {
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      alert('Primero crea un proyecto antes de añadir tareas.');
      this.openProjectModal();
      return;
    }

    const projSelect = document.getElementById('add-task-project-id');
    if (projSelect) {
      projSelect.innerHTML = projects.map(p => `
        <option value="${p.id}" ${(projectId === p.id || (!projectId && p.id === this.selectedKanbanProjectId)) ? 'selected' : ''}>
          ${p.emoji || '📁'} ${this.escapeHtml(p.name)}
        </option>
      `).join('');
    }

    document.getElementById('add-task-title').value = '';
    document.getElementById('add-task-column').value = columnKey || 'proximo';
    document.getElementById('add-task-effort').value = 'S';
    document.getElementById('add-task-is-bureaucratic').checked = false;
    document.getElementById('add-task-notes').value = '';
    document.getElementById('add-task-due').value = '';

    this.openModal('modal-add-task');
    setTimeout(() => document.getElementById('add-task-title')?.focus(), 100);
  },

  submitCreateTask(e) {
    e.preventDefault();
    const projId = document.getElementById('add-task-project-id').value;
    const title = document.getElementById('add-task-title').value.trim();
    const column = document.getElementById('add-task-column').value;
    const effort = document.getElementById('add-task-effort').value;
    const isBureaucratic = document.getElementById('add-task-is-bureaucratic').checked;
    const notes = document.getElementById('add-task-notes').value.trim();
    const dueAt = this.dueFromInput(document.getElementById('add-task-due').value);

    if (!title) return;

    const project = (this.state.projects || []).find(p => p.id === projId);
    if (!project) return;

    if (column === 'enfoco') {
      const count = (project.tasks || []).filter(t => t.column === 'enfoco').length;
      if (count >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    const newTask = {
      id: this.uid(),
      title: title,
      column: column,
      effort: effort,
      isBureaucratic: isBureaucratic,
      notes: notes || null,
      dueAt,
      createdAt: new Date().toISOString()
    };

    if (!project.tasks) project.tasks = [];
    project.tasks.push(newTask);
    if (dueAt && this.backendAvailable) this.scheduleBackgroundPush(newTask.id, title, dueAt).catch(() => {});
    this.saveState();
    this.closeModal('modal-add-task');
    this.showToast('✓ Tarea agregada con éxito');
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/projects/${projId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      }).catch(() => {});
    }
  },

  openEditTaskModal(projectId, taskId) {
    const project = (this.state.projects || []).find(p => p.id === projectId);
    if (!project) return;
    const task = (project.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    const projects = this.state.projects || [];
    const projSelect = document.getElementById('edit-task-project-id');
    if (projSelect) {
      projSelect.innerHTML = projects.map(p => `
        <option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>
          ${p.emoji || '📁'} ${this.escapeHtml(p.name)}
        </option>
      `).join('');
    }

    document.getElementById('edit-task-original-project-id').value = projectId;
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-column').value = task.column || 'buzon';
    document.getElementById('edit-task-effort').value = task.effort || 'M';
    document.getElementById('edit-task-is-bureaucratic').checked = !!task.isBureaucratic;
    document.getElementById('edit-task-notes').value = task.notes || '';
    document.getElementById('edit-task-code').value = task.codeSnippet || '';
    document.getElementById('edit-task-due').value = this.dueToInput(task.dueAt);
    const stepInput = document.getElementById('edit-task-step-input');
    if (stepInput) stepInput.value = '';
    this.cargarPasosEdicion(task);

    this.openModal('modal-edit-task');
  },

  saveTaskEdit(e) {
    e.preventDefault();
    const origProjId = document.getElementById('edit-task-original-project-id').value;
    const newProjId = document.getElementById('edit-task-project-id').value;
    const taskId = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value.trim();
    const column = document.getElementById('edit-task-column').value;
    const effort = document.getElementById('edit-task-effort').value;
    const isBureaucratic = document.getElementById('edit-task-is-bureaucratic').checked;
    const notes = document.getElementById('edit-task-notes').value.trim();
    const codeSnippet = document.getElementById('edit-task-code').value.trim();
    const dueAt = this.dueFromInput(document.getElementById('edit-task-due').value);

    if (!title) return;

    const origProject = (this.state.projects || []).find(p => p.id === origProjId);
    if (!origProject) return;

    const targetProject = (this.state.projects || []).find(p => p.id === newProjId) || origProject;

    // Verificar límite WIP si se mueve a 'enfoco'
    if (column === 'enfoco') {
      const currentEnfoco = (targetProject.tasks || []).filter(t => t.column === 'enfoco' && t.id !== taskId);
      if (currentEnfoco.length >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    const taskIndex = (origProject.tasks || []).findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = origProject.tasks[taskIndex];
    task.title = title;
    task.column = column;
    task.effort = effort;
    task.isBureaucratic = isBureaucratic;
    task.notes = notes || null;
    task.codeSnippet = codeSnippet || null;
    // Un paso escrito y sin pulsar Enter también cuenta
    const pendiente = (document.getElementById('edit-task-step-input')?.value || '').trim();
    task.steps = PasosCore.normalizar([...(this._editSteps || []), ...(pendiente ? [{ text: pendiente }] : [])]);
    // Fecha nueva → mover el aviso push (el servidor reemplaza el pendiente de esta tarea)
    if (dueAt && dueAt !== task.dueAt && this.backendAvailable) this.scheduleBackgroundPush(task.id, title, dueAt).catch(() => {});
    task.dueAt = dueAt;
    task.updatedAt = new Date().toISOString();

    // Si cambió de proyecto asignado:
    if (origProjId !== newProjId) {
      origProject.tasks.splice(taskIndex, 1);
      if (!targetProject.tasks) targetProject.tasks = [];
      targetProject.tasks.push(task);
    }

    this.saveState();
    this.closeModal('modal-edit-task');
    this.showToast('✓ Tarea actualizada');
    this.render();

    // Antes los cambios de la tarea solo llegaban al servidor con la sincronización completa
    if (this.backendAvailable) {
      const { id: _id, ...campos } = task;
      fetch(`${this.API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos) // el cambio de proyecto lo lleva la sincronización (projectId es reservado)
      }).catch(() => {});
    }
  },

  deleteTaskFromEditModal() {
    const origProjId = document.getElementById('edit-task-original-project-id').value;
    const taskId = document.getElementById('edit-task-id').value;
    if (!origProjId || !taskId) return;
    this.closeModal('modal-edit-task');
    this.deleteTask(origProjId, taskId);
  },
});
