// NetworkConfig and Styles
const NetworkConfig = {
  radius: 120,
  node: {
    base: {
      mass: 1,
      fixed: false,
      physics: true,
      font: { color: '#00ff00', size: 16, face: 'Arial' },
      shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 0, x: 5, y: 5 },
      shape: 'box',
      size: 20,
      color: { 
        background: '#000000', 
        border: '#00ff00',
        highlight: {
          background: '#001100',
          border: '#00ff00'
        },
        hover: {
          background: '#001100',
          border: '#00ff00'
        }
      }
    },
    center: {
      shape: 'image',
      physics: false,
      shapeProperties: {
        useBorderWithImage: false,
        useImageSize: true
      }
    },
    filter: {
      mass: 2,
      physics: true,
      fixed: false,
    },
    project: {
      mass: 1,
      physics: true,
      fixed: false,
      color: { 
        background: '#000000', 
        border: '#00ff00',
        highlight: {
          background: '#001100',
          border: '#00ff00'
        },
        hover: {
          background: '#001100',
          border: '#00ff00'
        }
      }
    }
  },
  edge: {
    smooth: { 
      enabled: true, 
      type: 'cubicBezier',
      roundness: 0.6,
      forceDirection: 'none'
    },
    width: 1,
    color: { color: '#00ff00', highlight: '#00bb00' },
    shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 0, x: 5, y: 5 },
    length: 120,
    physics: true
  },
  physics: {
    enabled: true,
    stabilization: { 
      enabled: true,
      iterations: 100,
      updateInterval: 25
    },
    barnesHut: {
      gravitationalConstant: -1000,
      centralGravity: 0.3,
      springLength: 120,
      springConstant: 0.08,
      damping: 0.09,
      avoidOverlap: 0.5
    },
    repulsion: {
      nodeDistance: 120
    },
    solver: 'barnesHut',
    minVelocity: 0.75,
    maxVelocity: 10,
    timestep: 0.4,
    adaptiveTimestep: true
  },
  interaction: {
    hover: true,
    hoverConnectedEdges: false,
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: false,
    multiselect: false,
    navigationButtons: false,
    keyboard: false
  }
};

// DataFetcher class
class DataFetcher {
  static getProjectCategories(description) {
    const bracketPattern = /\[(.*?)\]/g;
    const categories = new Set();
    let match;
    
    while ((match = bracketPattern.exec(description)) !== null) {
      const category = match[1].trim();
      if (category) categories.add(category);
    }

    return Array.from(categories);
  }
}

// NetworkManager class
class NetworkManager {
  constructor(container) {
    this.container = container;
    this.network = null;
    this.projectData = [];
    this.currentCard = null;
    this.expandedCategory = null;
    this.untaggedProjects = {
      public: [],
      private: []
    };
    this.categoryPageMap = new Map();
    this.paginationControls = null;
  }

  async initialize() {
    if (!window.vis) {
      await this.loadVisNetwork();
    }
    
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    
    const nodeDefaults = {
      ...NetworkConfig.node.base,
      color: NetworkConfig.node.base.color
    };

    const edgeDefaults = {
      ...NetworkConfig.edge,
      smooth: {
        enabled: true,
        type: 'cubicBezier',
        roundness: 0.6,
        forceDirection: 'none'
      }
    };
    
    this.network = new vis.Network(
      this.container,
      { nodes, edges },
      {
        nodes: nodeDefaults,
        edges: edgeDefaults,
        physics: NetworkConfig.physics,
        interaction: NetworkConfig.interaction
      }
    );

    this.setupEventListeners();
  }

  async loadVisNetwork() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  setupEventListeners() {
    this.network.on('click', this.handleNodeClick.bind(this));
    
    this.network.on('click', (params) => {
      if (params.nodes.length === 0 && this.expandedCategory) {
        this.collapseCategory();
      }
    });

    this.network.on('stabilizationIterationsDone', () => {
      const nodes = this.network.body.data.nodes;
      const categoryNodes = nodes.get().filter(n => n.id !== 'center');
      const radius = NetworkConfig.radius;

      categoryNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / categoryNodes.length;
        nodes.update({
          id: node.id,
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
          ...NetworkConfig.node.filter,
          physics: true
        });
      });
      
      this.network.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    });
  }

  handleNodeClick(params) {
    if (!params.nodes.length) return;

    const nodeId = params.nodes[0];
    if (nodeId === 'center') return;

    const node = this.network.body.data.nodes.get(nodeId);
    
    if (nodeId.startsWith('project_')) {
      this.network.body.data.nodes.update({
        id: nodeId,
        physics: false,
        fixed: false
      });
      this.handleProjectNodeClick(node);
    } else {
      this.handleCategoryNodeClick(nodeId);
    }
  }

  handleProjectNodeClick(node) {
    const projectData = this.projectData.find(p => p.project.id === node.projectId);
    if (!projectData) return;

    const existingCard = this.container.querySelector(`[data-project-id="${node.projectId}"]`);
    if (existingCard) {
      existingCard.remove();
      return;
    }

    const newCard = new ProjectCard(projectData, this.network);
    const card = newCard.show(node.id);
    this.container.appendChild(card);
  }

  handleCategoryNodeClick(categoryId) {
    const cards = this.container.querySelectorAll('.project-card');
    cards.forEach(card => card.remove());

    if (this.expandedCategory === categoryId) {
      this.collapseCategory();
    } else {
      this.expandCategory(categoryId);
    }
  }

  expandCategory(categoryId) {
    const cards = this.container.querySelectorAll('.project-card');
    cards.forEach(card => card.remove());

    if (this.paginationControls) {
      this.paginationControls.remove();
      this.paginationControls = null;
    }

    const nodes = this.network.body.data.nodes;
    
    nodes.get().forEach(node => {
      if (node.id !== 'center' && !node.id.startsWith('project_')) {
        nodes.update({
          id: node.id,
          hidden: node.id !== categoryId,
          color: NetworkConfig.node.base.color
        });
      }
    });

    const categoryNode = nodes.get(categoryId);
    const centerNode = nodes.get('center');
    const pinRadius = NetworkConfig.radius * 0.8;
    
    const angle = Math.atan2(categoryNode.y - centerNode.y, categoryNode.x - centerNode.x);
    const pinX = centerNode.x + pinRadius * Math.cos(angle);
    const pinY = centerNode.y + pinRadius * Math.sin(angle);
    
    nodes.update({
      id: categoryId,
      x: pinX,
      y: pinY,
      physics: false,
      fixed: true
    });

    const currentPage = this.categoryPageMap.get(categoryId) || 0;
    const pageSize = 50;

    const filteredProjects = this.filterProjectsByCategory(categoryId);
    const totalPages = Math.ceil(filteredProjects.length / pageSize);

    const projectsToDisplay = filteredProjects.slice(
      currentPage * pageSize, 
      (currentPage + 1) * pageSize
    );

    const scale = this.network.getScale();

    const baseCardWidth = 300;
    const baseCardHeight = 400;
    const nodeToCardSpacing = 20;
    const minSpacing = 50;
    
    const gridSize = Math.ceil(Math.sqrt(projectsToDisplay.length));
    
    const unitWidth = baseCardWidth;
    const unitHeight = baseCardHeight + nodeToCardSpacing;
    
    const gridWidth = unitWidth * gridSize + minSpacing * (gridSize - 1);
    const gridHeight = unitHeight * gridSize + minSpacing * (gridSize - 1);

    const vectorX = pinX - centerNode.x;
    const vectorY = pinY - centerNode.y;
    const vectorLength = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
    
    const safetyMargin = baseCardWidth;
    const shiftDistance = gridWidth / 2 + pinRadius + safetyMargin;
    const normalizedVectorX = vectorX / vectorLength;
    const normalizedVectorY = vectorY / vectorLength;

    const perpX = -normalizedVectorY;
    const perpY = normalizedVectorX;
    
    const gridCenterX = pinX + perpX * shiftDistance;
    const gridCenterY = pinY + perpY * shiftDistance;
    
    const startX = gridCenterX - gridWidth / 2;
    const startY = gridCenterY - gridHeight / 2;

    projectsToDisplay.forEach((projectData, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      const unitX = startX + col * (unitWidth + minSpacing);
      const unitY = startY + row * (unitHeight + minSpacing);

      const nodeX = unitX + (unitWidth / 2);
      const nodeY = unitY;

      const nodeId = `project_${projectData.project.id}`;

      nodes.add({
        ...NetworkConfig.node.project,
        id: nodeId,
        label: projectData.project.title || 'Untitled Project',
        projectId: projectData.project.id,
        x: nodeX,
        y: nodeY,
        physics: false,
        fixed: false
      });

      this.network.body.data.edges.add({
        ...NetworkConfig.edge,
        from: categoryId,
        to: nodeId,
        physics: false,
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          roundness: 0.6,
          forceDirection: 'none'
        }
      });

      const card = new ProjectCard(projectData, this.network);
      const cardElement = card.show(nodeId);
      this.container.appendChild(cardElement);
    });

    if (totalPages > 1) {
      this.createPaginationControls(categoryId, currentPage, totalPages);
    }

    this.expandedCategory = categoryId;
    
    this.network.fit({
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });
  }

  createPaginationControls(categoryId, currentPage, totalPages) {
    const pagination = document.createElement('div');
    pagination.className = 'pagination-controls';

    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button';
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 0;
    prevButton.addEventListener('click', () => {
      this.changePage(categoryId, currentPage - 1);
    });

    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button';
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage + 1 >= totalPages;
    nextButton.addEventListener('click', () => {
      this.changePage(categoryId, currentPage + 1);
    });

    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;

    pagination.appendChild(prevButton);
    pagination.appendChild(pageInfo);
    pagination.appendChild(nextButton);

    pagination.style.position = 'absolute';
    pagination.style.bottom = '20px';
    pagination.style.left = '50%';
    pagination.style.transform = 'translateX(-50%)';
    pagination.style.zIndex = '1000';

    this.container.appendChild(pagination);
    this.paginationControls = pagination;
  }

  changePage(categoryId, newPage) {
    this.categoryPageMap.set(categoryId, newPage);

    const nodes = this.network.body.data.nodes;
    nodes.remove(nodes.get().filter(node => node.id.startsWith('project_')));

    const cards = this.container.querySelectorAll('.project-card');
    cards.forEach(card => card.remove());

    const edges = this.network.body.data.edges;
    edges.remove(edges.get().filter(edge => edge.from === categoryId && edge.to.startsWith('project_')));

    if (this.paginationControls) {
      this.paginationControls.remove();
      this.paginationControls = null;
    }

    this.expandCategory(categoryId);
  }

  collapseCategory() {
    const cards = this.container.querySelectorAll('.project-card');
    cards.forEach(card => card.remove());

    const nodes = this.network.body.data.nodes;
    
    nodes.remove(nodes.get().filter(node => node.id.startsWith('project_')));

    const categoryNodes = nodes.get().filter(n => n.id !== 'center');
    const radius = NetworkConfig.radius;

    categoryNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / categoryNodes.length;
      nodes.update({
        id: node.id,
        hidden: false,
        ...NetworkConfig.node.filter,
        color: NetworkConfig.node.base.color,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        physics: true
      });
    });

    this.expandedCategory = null;

    setTimeout(() => {
      categoryNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / categoryNodes.length;
        nodes.update({
          id: node.id,
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle)
        });
      });

      this.network.fit({
        nodes: ['center'],
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    }, 100);
  }

  addCategoryNodes(categories, nodes, edges) {
    const radius = NetworkConfig.radius;
    categories.forEach((category, index) => {
      const angle = (2 * Math.PI * index) / categories.length;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      nodes.add({
        ...NetworkConfig.node.base,
        id: category.title,
        label: category.title,
        x,
        y,
        physics: false,
        fixed: true,
        color: NetworkConfig.node.base.color
      });

      edges.add({
        from: 'center',
        to: category.title,
        length: radius,
        physics: false,
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          roundness: 0.6,
          forceDirection: 'none'
        }
      });
    });

    setTimeout(() => {
      categories.forEach(category => {
        nodes.update({
          id: category.title,
          physics: true,
          fixed: false
        });
      });

      const edgeIds = edges.getIds();
      edgeIds.forEach(edgeId => {
        edges.update({
          id: edgeId,
          physics: true,
          smooth: {
            enabled: true,
            type: 'cubicBezier',
            roundness: 0.6,
            forceDirection: 'none'
          }
        });
      });
    }, 1000);
  }

  filterProjectsByCategory(categoryId) {
    if (categoryId === 'untagged') {
      return this.untaggedProjects.public;
    } else if (categoryId === 'Private') {
      return this.untaggedProjects.private;
    } else {
      return this.projectData.filter(projectData => {
        const description = (projectData.project.description || '').toLowerCase();
        const bracketPattern = new RegExp(`\\[${categoryId.toLowerCase()}\\]`);
        return bracketPattern.test(description);
      });
    }
  }

  setProjectData(data) {
    this.projectData = data;
  }

  setUntaggedProjects(untaggedProjects) {
    this.untaggedProjects = untaggedProjects;
  }
}

// ProjectCard class
class ProjectCard {
  constructor(projectData, network) {
    this.projectData = projectData;
    this.network = network;
    this.element = null;
    this.nodeId = null;
    this.animationFrame = null;
    this.isDragging = false;
  }

  show(nodeId) {
    this.nodeId = nodeId;
    this.element = this.createElement();
    this.startPositionUpdate();
    this.setupInteraction();
    return this.element;
  }

  showFullscreen() {
    const existingOverlay = document.querySelector('.fullscreen-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    document.dispatchEvent(new CustomEvent('projectCardChange', {
      detail: { projectId: this.projectData.project.id }
    }));

    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';

    const iframe = document.createElement('iframe');
    iframe.src = `https://websim.ai/p/${this.projectData.project.id}`;
    iframe.style.cssText = `
      width: 100vw;
      height: 100vh;
      border: none;
      position: absolute;
      top: 0;
      left: 0;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
      document.dispatchEvent(new CustomEvent('projectCardChange', {
        detail: { projectId: null }
      }));
      overlay.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.appendChild(iframe);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
  }

  cleanup() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.element) {
      document.dispatchEvent(new CustomEvent('projectCardChange', {
        detail: { projectId: null }
      }));
      this.element.remove();
      this.element = null;
    }
  }

  startPositionUpdate() {
    const updatePosition = () => {
      if (!this.element || !this.network?.body?.nodes[this.nodeId]) {
        this.cleanup();
        return;
      }

      const node = this.network.body.nodes[this.nodeId];
      const scale = this.network.getScale();
      
      this.element.style.transform = `translate(-50%, 0) scale(${scale})`;
      
      const pos = this.network.canvasToDOM({
        x: node.x,
        y: node.y + (10 * 1/scale)
      });

      this.element.style.left = `${pos.x}px`;
      this.element.style.top = `${pos.y}px`;

      this.animationFrame = requestAnimationFrame(updatePosition);
    };

    this.animationFrame = requestAnimationFrame(updatePosition);
  }

  createElement() {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = this.projectData.project.id; 

    card.innerHTML = `
      <img class="project-image" 
           src="https://images.websim.ai/v1/site/${this.projectData.site?.id}/600" 
           alt="${this.projectData.project.title || 'Untitled Project'}"
           onerror="this.src='https://placehold.co/600x400/png?text=No+Image'"
           draggable="false">
      <div class="card-content">
        <h3 class="card-title">${this.projectData.project.title || 'Untitled Project'}</h3>
        <p class="card-description">${this.projectData.project.description || 'No description'}</p>
        <div class="stats">
          <span class="stats-item">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
            </svg>
            ${this.projectData.project.stats.views}
          </span>
          <span class="stats-item">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${this.projectData.project.stats.likes}
          </span>
        </div>
      </div>
    `;

    return card;
  }

  setupInteraction() {
    const network = this.network;
    let isDragging = false;
    let startX, startY;

    const pointerDownHandler = (e) => {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;

      const view = network.getViewPosition();

      const pointerMoveHandler = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isDragging = true;
        }

        if (isDragging) {
          const scale = network.getScale();
          network.moveTo({
            position: {
              x: view.x - dx / scale,
              y: view.y - dy / scale
            },
            animation: false
          });
          e.preventDefault();
        }
      };

      const pointerUpHandler = (e) => {
        this.element.removeEventListener('pointermove', pointerMoveHandler);
        this.element.removeEventListener('pointerup', pointerUpHandler);
        this.element.releasePointerCapture(e.pointerId);

        if (!isDragging) {
          setTimeout(() => this.showFullscreen(), 0);
        }

        isDragging = false;
      };

      this.element.addEventListener('pointermove', pointerMoveHandler);
      this.element.addEventListener('pointerup', pointerUpHandler);
      this.element.setPointerCapture(e.pointerId);
    };

    this.element.addEventListener('pointerdown', pointerDownHandler);

    this.element.style.userSelect = 'none';
    this.element.style.touchAction = 'none';
  }
}

// UserAvatarElement class
class UserAvatarElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.networkManager = null;
  }

  async connectedCallback() {
    this.setupStyles();
    const container = document.createElement('div');
    container.className = 'container';
    
    const mindmapDiv = document.createElement('div');
    mindmapDiv.id = 'mindmap';
    
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Loading profile data...';
    
    container.appendChild(mindmapDiv);
    container.appendChild(loading);
    this.shadowRoot.appendChild(container);
    
    await this.initialize();
  }

  disconnectedCallback() {
    if (this.networkManager) {
      if (this.networkManager.currentCard) {
        this.networkManager.currentCard.cleanup();
      }
      this.networkManager = null;
    }
  }

  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      position: relative;
      z-index: 2;
      overflow: hidden;
    }
    :host-context(body) {
      margin: 0;
      padding: 0;
      background: #0a0a1a;
      color: #fff;
      font-family: 'Arial', sans-serif;
      height: 100vh;
      width: 100vw;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    #mindmap {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 14px;
      background: rgba(0,0,0,0.7);
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 100;
    }
    .project-card {
      position: absolute;
      background: rgba(25, 25, 35, 0.95);
      border-radius: 12px;
      box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
      width: 300px;
      cursor: pointer;
      transform-origin: center top;
      animation: fadeIn 0.3s ease-out;
      z-index: 1000;
      overflow: hidden;
      user-select: none;
      touch-action: none;
    }
    .project-card:hover {
      filter: brightness(1.1);
    }
    .project-image {
      width: 100%;
      height: 225px;
      object-fit: cover;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .card-content {
      padding: 20px;
    }
    .card-title {
      margin: 0 0 12px 0;
      font-size: 22px;
      color: #fff;
    }
    .card-description {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #aaa;
      line-height: 1.5;
      max-height: 72px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .stats {
      display: flex;
      gap: 20px;
      color: #aaa;
      font-size: 16px;
    }
    .stats-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .close-button {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      z-index: 2000;
    }
    .close-button:hover {
      background: rgba(0, 0, 0, 0.8);
    }
    .fullscreen-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      animation: fadeIn 0.3s ease-out;
      overflow: hidden;
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(25, 25, 35, 0.95);
      padding: 8px 16px;
      border-radius: 4px;
      color: #fff;
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
    }
    .pagination-button {
      background: #00ff00;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      color: #000;
      font-weight: bold;
      cursor: pointer;
    }
    .pagination-button:disabled {
      background: #555;
      cursor: not-allowed;
    }
    .pagination-info {
      font-size: 16px;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    :host ::selection {
      background: transparent;
    }
    `;
    this.shadowRoot.appendChild(style);
  }

  async initialize() {
    try {
      const creator = await window.websim.getCreatedBy();
      if (!creator?.username) {
        this.showError('Could not load profile');
        return;
      }

      const mindmapContainer = this.shadowRoot.getElementById('mindmap');
      this.networkManager = new NetworkManager(mindmapContainer);
      await this.networkManager.initialize();

      const projectData = [];
      let hasNextPage = true;
      let afterCursor = null;

      while (hasNextPage) {
        const params = new URLSearchParams({
          first: '100',
          include_old: 'true'
        });
        if (afterCursor) params.append('after', afterCursor);
        
        const response = await fetch(`/api/v1/users/${creator.username}/projects?${params.toString()}`);
        const data = await response.json();
        const projectsData = data.projects;
        
        projectsData.data.forEach(project => {
          projectData.push(project);
        });
        
        hasNextPage = projectsData.meta.has_next_page;
        afterCursor = projectsData.meta.end_cursor;
      }

      this.networkManager.setProjectData(projectData);
      
      const { categories, untaggedProjects } = this.getCategories();
      this.networkManager.setUntaggedProjects(untaggedProjects);

      await this.setupNetwork(creator, categories);
      this.hideLoading();
    } catch (err) {
      console.error('Error initializing:', err);
      this.showError('Error loading profile');
    }
  }

  showError(message) {
    const loading = this.shadowRoot.querySelector('.loading');
    if (loading) loading.textContent = message;
  }

  hideLoading() {
    const loading = this.shadowRoot.querySelector('.loading');
    if (loading) loading.style.display = 'none';
  }

  async setupNetwork(creator, categories) {
    const nodes = this.networkManager.network.body.data.nodes;
    const edges = this.networkManager.network.body.data.edges;

    nodes.add({
      id: 'center',
      label: creator.username,
      ...NetworkConfig.node.center,
      image: `https://images.websim.ai/avatar/${creator.username}`,
      size: 80,
      physics: false,
      x: 0,
      y: 0
    });

    this.networkManager.addCategoryNodes(categories, nodes, edges);
  }

  getCategories() {
    const categoryMap = new Map();
    const untaggedPublicProjects = [];
    const untaggedPrivateProjects = [];
    
    this.networkManager.projectData.forEach(data => {
      const categories = DataFetcher.getProjectCategories(data.project.description || '');
      if (categories.length > 0) {
        categories.forEach(category => {
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { title: category });
          }
        });
      } else {
        if (data.project.visibility === 'public') {
          untaggedPublicProjects.push(data);
        } else if (data.project.visibility === 'private') {
          untaggedPrivateProjects.push(data);
        }
      }
    });

    if (untaggedPublicProjects.length > 0) {
      categoryMap.set('untagged', { title: 'untagged' });
    }

    if (untaggedPrivateProjects.length > 0) {
      categoryMap.set('Private', { title: 'Private' });
    }

    const categories = Array.from(categoryMap.values());

    return {
      categories,
      untaggedProjects: {
        public: untaggedPublicProjects,
        private: untaggedPrivateProjects
      }
    };
  }
}

customElements.define('user-avatar', UserAvatarElement);

// Add global styles to document
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #0a0a1a;
    color: #fff;
    font-family: 'Arial', sans-serif;
  }

  .stats-counter {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(25, 25, 35, 0.95);
    padding: 15px 25px;
    border-radius: 0 0 12px 12px;
    display: flex;
    gap: 30px;
    z-index: 10000;
    box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: none;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    user-select: none;
  }

  .stats-counter.hidden {
    transform: translate(-50%, -100%);
  }

  .stats-counter-tab {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(25, 25, 35, 0.95);
    padding: 8px 15px;
    border-radius: 0 0 8px 8px;
    z-index: 10000;
    box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 15px;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
    user-select: none;
  }

  .stats-counter-tab .action-buttons {
    display: flex;
    gap: 10px;
    margin-right: 15px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .stats-counter-tab.has-active-card .action-buttons {
    opacity: 1;
    pointer-events: auto;
  }

  .stats-counter-tab button {
    background: #00ff00;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    color: #000;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
  }

  .stats-counter-tab button:hover {
    background: #00dd00;
  }

  .stats-counter-tab .toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stats-counter-tab .toggle-icon svg {
    width: 20px;
    height: 20px;
    fill: #00ff00;
    transform: rotate(180deg);
  }

  .stats-counter-tab.visible {
    visibility: visible;
    opacity: 1;
  }

  .stats-counter-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #aaa;
  }

  .stats-counter-value {
    font-size: 24px;
    color: #00ff00;
    font-weight: bold;
  }

  .stats-counter-label {
    font-size: 14px;
    margin-top: 4px;
  }
`;
document.head.appendChild(globalStyle);

// Initialize stats counter functionality
document.addEventListener('DOMContentLoaded', async () => {
  const statsCounter = document.createElement('div');
  statsCounter.className = 'stats-counter';
  statsCounter.innerHTML = `
    <div class="stats-counter-item">
      <span class="stats-counter-value" id="total-views">0</span>
      <span class="stats-counter-label">Total Views</span>
    </div>
    <div class="stats-counter-item">
      <span class="stats-counter-value" id="profile-views">0</span>
      <span class="stats-counter-label">Profile Views</span>
    </div>
    <div class="stats-counter-item">
      <span class="stats-counter-value" id="total-likes">0</span>
      <span class="stats-counter-label">Total Likes</span>
    </div>
  `;

  const toggleTab = document.createElement('div');
  toggleTab.className = 'stats-counter-tab hidden';
  toggleTab.innerHTML = `
    <div class="action-buttons">
      <button id="open-button">Open</button>
    </div>
    <div class="toggle-icon">
      <svg viewBox="0 0 24 24">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
      </svg>
    </div>
  `;

  document.body.appendChild(statsCounter);
  document.body.appendChild(toggleTab);

  const openButton = toggleTab.querySelector('#open-button');
  let userAvatar = document.querySelector('user-avatar');
  let currentProjectId = null;

  document.addEventListener('projectCardChange', (e) => {
    currentProjectId = e.detail.projectId;
    toggleTab.classList.toggle('has-active-card', currentProjectId !== null);
  });

  openButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentProjectId) {
      window.open(`https://websim.ai/p/${currentProjectId}`, '_blank');
    }
  });

  statsCounter.addEventListener('click', () => {
    statsCounter.classList.add('hidden');
    setTimeout(() => {
      toggleTab.classList.add('visible');
    }, 300);

    if (userAvatar) {
      userAvatar.remove();
      userAvatar = null;
    }
  });

  toggleTab.addEventListener('click', () => {
    statsCounter.classList.remove('hidden');
    toggleTab.classList.remove('visible');

    if (!userAvatar) {
      userAvatar = document.createElement('user-avatar');
      document.body.appendChild(userAvatar);
    }
  });

  try {
    const creator = await window.websim.getCreatedBy();
    if (creator && creator.username) {
      const profileStatsResponse = await fetch(`/api/v1/users/${creator.username}/stats`);
      const profileStatsData = await profileStatsResponse.json();
      const profileStats = profileStatsData.stats || {};

      const profileViewsElement = document.getElementById('profile-views');
      profileViewsElement.textContent = ((profileStats.total_views || 0) + 1).toLocaleString();

      let totalViews = 0;
      let totalLikes = 0;
      let hasNextPage = true;
      let afterCursor = null;

      while (hasNextPage) {
        const params = new URLSearchParams({
          first: '100',
          include_old: 'true'
        });
        if (afterCursor) params.append('after', afterCursor);
        
        const response = await fetch(`/api/v1/users/${creator.username}/projects?${params.toString()}`);
        const data = await response.json();
        const projectsData = data.projects;
        
        projectsData.data.forEach(project => {
          totalViews += project.project?.stats?.views || 0;
          totalLikes += project.project?.stats?.likes || 0;
        });
        
        hasNextPage = projectsData.meta.has_next_page;
        afterCursor = projectsData.meta.end_cursor;
      }

      document.getElementById('total-views').textContent = totalViews.toLocaleString();
      document.getElementById('total-likes').textContent = totalLikes.toLocaleString();
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
});