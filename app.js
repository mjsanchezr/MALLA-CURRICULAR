// Estado global
const coursesByName = {};
const passedCourses = JSON.parse(localStorage.getItem('malla_passed_courses') || '[]');
let showFlow = false;
let totalCarreraUC = 0;

// Utilidades
const slugify = (text) => text.toLowerCase().replace(/[\s\W-]+/g, '-');

// Nodos principales
const container = document.getElementById('malla');
const ucTracker = document.getElementById('ucTracker');
const tooltip = document.getElementById('subjectTooltip');
const svgCanvas = document.getElementById('svgCanvas');
const btnToggleFlow = document.getElementById('btnToggleFlow');
const globalUCElement = document.getElementById('globalUC');

function init() {
    if (!window.mallaData) return;
    
    // Calcular total UC de la carrera
    window.mallaData.forEach(sem => {
        sem.forEach(c => totalCarreraUC += (parseInt(c.uc) || 0));
    });
    
    renderMalla();
    computePostReqs();
    updateGlobalStats();
    
    // Event listener para el botón de flujo
    btnToggleFlow.addEventListener('click', toggleFlow);
    
    // Redibujar flechas si se cambia el tamaño de la ventana (y está activo)
    window.addEventListener('resize', () => {
        if(showFlow) drawAllArrows();
    });
}

function renderMalla() {
    window.mallaData.forEach((semester, sIndex) => {
        const semCol = document.createElement('div');
        semCol.className = 'semester-col';
        
        const header = document.createElement('div');
        header.className = 'semester-header';
        
        let semUC = semester.reduce((sum, course) => sum + (parseInt(course.uc) || 0), 0);
        
        header.innerHTML = `Semestre ${sIndex + 1}<br><span style="font-size:0.8rem; font-weight:normal; color:#94a3b8">${semUC} UC</span>`;
        semCol.appendChild(header);
        
        semester.forEach(course => {
            coursesByName[course.nombre] = course;
            course.postreqs = []; 
            // NUEVO: Generar ID único basado en el nombre de la materia
            course.elementId = `course-${slugify(course.nombre)}`;
            course.semesterIndex = sIndex + 1;
            
            const card = document.createElement('div');
            card.className = `subject-card area-${course.area}`;
            if (passedCourses.includes(course.nombre)) {
                card.classList.add('is-passed');
            }
            card.id = course.elementId;
            
            let reqText = '';
            if(course.prelaciones && course.prelaciones.length > 0) {
                const reqTypes = course.prelaciones.map(p => p.tipo === 'UC' ? `${p.valor} UC` : 'Mat').join(', ');
                reqText = `<span class="req-indicator">Pre: ${reqTypes}</span>`;
            }
            
            card.innerHTML = `
                <div class="subject-code">${course.codigo}</div>
                <div class="subject-name">${course.nombre}</div>
                <div class="subject-footer">
                    <span class="subject-uc">${course.uc} UC</span>
                    ${reqText}
                </div>
            `;
            
            // Hover logic
            card.addEventListener('mouseenter', (e) => handleHover(course, true, e));
            card.addEventListener('mouseleave', () => handleHover(course, false));
            card.addEventListener('mousemove', updateTooltipPosition);
            
            // Click logic: Marcar como aprobada
            card.addEventListener('click', () => togglePassedStatus(course.nombre, card));
            
            semCol.appendChild(card);
        });
        
        container.appendChild(semCol);
    });
}

function computePostReqs() {
    window.mallaData.forEach(semester => {
        semester.forEach(course => {
            if (course.prelaciones) {
                course.prelaciones.forEach(pre => {
                    if (pre.tipo === 'materia') {
                        const preCourse = coursesByName[pre.valor];
                        if (preCourse) {
                            preCourse.postreqs.push(course.nombre);
                        }
                    }
                });
            }
        });
    });
}

function togglePassedStatus(nombre, cardElement) {
    const idx = passedCourses.indexOf(nombre);
    if (idx === -1) {
        passedCourses.push(nombre);
        cardElement.classList.add('is-passed');
    } else {
        passedCourses.splice(idx, 1);
        cardElement.classList.remove('is-passed');
    }
    
    // Guardar en localStorage
    localStorage.setItem('malla_passed_courses', JSON.stringify(passedCourses));
    updateGlobalStats();
}

function updateGlobalStats() {
    let currentUC = 0;
    passedCourses.forEach(nombre => {
        const course = coursesByName[nombre];
        if(course) {
            currentUC += parseInt(course.uc) || 0;
        }
    });
    
    let percent = ((currentUC / totalCarreraUC) * 100).toFixed(1);
    globalUCElement.innerHTML = `${currentUC} / ${totalCarreraUC} UC Aprobadas (${percent}%)`;
}

function updateTooltipPosition(e) {
    if(tooltip.style.display === 'block') {
        const x = e.pageX + 15;
        const y = e.pageY + 15;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }
}

function handleHover(course, isEntering, e) {
    if (isEntering) {
        document.body.classList.add('interacting');
        
        const activeEl = document.getElementById(course.elementId);
        if(activeEl) activeEl.classList.add('is-active');
        
        let ucReqStr = "";
        let preNames = [];
        let coreqNames = [];
        
        if (course.prelaciones) {
            course.prelaciones.forEach(pre => {
                if (pre.tipo === 'materia') {
                    const preCourse = coursesByName[pre.valor];
                    if (preCourse) {
                        const el = document.getElementById(preCourse.elementId);
                        if(el) {
                            if (pre.correquisito) {
                                el.classList.add('is-coreq');
                                coreqNames.push(pre.valor);
                            } else {
                                el.classList.add('is-pre');
                                preNames.push(pre.valor);
                            }
                        }
                    }
                } else if (pre.tipo === 'UC') {
                    ucReqStr = `Requiere tener aprobadas <strong>${pre.valor} UC</strong> en total.`;
                }
            });
        }
        
        if (course.postreqs) {
            course.postreqs.forEach(postName => {
                const postCourse = coursesByName[postName];
                if (postCourse) {
                    const el = document.getElementById(postCourse.elementId);
                    if(el) el.classList.add('is-post');
                }
            });
        }
        
        if(ucReqStr) {
            ucTracker.style.display = 'block';
            document.getElementById('ucTitle').innerText = course.nombre;
            document.getElementById('ucReqs').innerHTML = ucReqStr;
        }
        
        let tooltipHtml = `<div class="tooltip-title">${course.nombre}</div>`;
        tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label">Código:</span> ${course.codigo}</div>`;
        tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label">Semestre:</span> ${course.semesterIndex}</div>`;
        tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label">UC:</span> ${course.uc}</div>`;
        
        if (preNames.length > 0) {
            tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label">Prerrequisitos:</span> ${preNames.join(', ')}</div>`;
        }
        if (coreqNames.length > 0) {
            tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label" style="color:var(--highlight-coreq)">Correquisitos:</span> ${coreqNames.join(', ')}</div>`;
        }
        if (ucReqStr) {
            tooltipHtml += `<div class="tooltip-row"><span class="tooltip-label">Pre UC:</span> ${course.prelaciones.find(p=>p.tipo==='UC').valor} UC</div>`;
        }
        
        tooltip.innerHTML = tooltipHtml;
        tooltip.style.display = 'block';
        if(e) updateTooltipPosition(e);
        
    } else {
        document.body.classList.remove('interacting');
        
        document.querySelectorAll('.subject-card').forEach(el => {
            el.classList.remove('is-active', 'is-pre', 'is-post', 'is-coreq');
        });
        
        ucTracker.style.display = 'none';
        tooltip.style.display = 'none';
    }
}

// ---- Funcionalidad SVG Flow Arrows ----

function toggleFlow() {
    showFlow = !showFlow;
    if (showFlow) {
        document.body.classList.add('flow-active');
        btnToggleFlow.classList.add('active');
        btnToggleFlow.innerText = "Ocultar Flujo de Prelaciones";
        drawAllArrows();
    } else {
        document.body.classList.remove('flow-active');
        btnToggleFlow.classList.remove('active');
        btnToggleFlow.innerText = "Mostrar Flujo de Prelaciones";
        svgCanvas.innerHTML = ''; // Limpiar SVG
    }
}

function drawAllArrows() {
    svgCanvas.innerHTML = ''; // Clear existing
    
    // Se dibujará desde la materia padre hacia la materia hija
    window.mallaData.forEach(semester => {
        semester.forEach(course => {
            if (course.prelaciones) {
                course.prelaciones.forEach(pre => {
                    if (pre.tipo === 'materia') {
                        const preCourse = coursesByName[pre.valor];
                        if (preCourse) {
                            const preEl = document.getElementById(preCourse.elementId);
                            const thisEl = document.getElementById(course.elementId);
                            if(preEl && thisEl) {
                                drawCurve(preEl, thisEl, pre.correquisito);
                            }
                        }
                    }
                });
            }
        });
    });
}

function drawCurve(el1, el2, isCoreq) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    
    // Asumimos layout de izquierda a derecha. 
    // Punto inicio: Centro derecha de pre-requisito
    // Punto fin: Centro izquierda de la materia actual
    const startX = rect1.right + window.scrollX;
    const startY = rect1.top + (rect1.height / 2) + window.scrollY;
    
    const endX = rect2.left + window.scrollX;
    const endY = rect2.top + (rect2.height / 2) + window.scrollY;
    
    const distanceX = endX - startX;
    // Puntos de control para la curva Bezier
    const cp1X = startX + (distanceX * 0.5);
    const cp1Y = startY;
    const cp2X = endX - (distanceX * 0.5);
    const cp2Y = endY;
    
    const color = isCoreq ? 'rgba(249, 115, 22, 0.5)' : 'rgba(239, 68, 68, 0.4)';
    const strokeWidth = 2;
    
    // Crear el Path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
    path.setAttribute("fill", "transparent");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", strokeWidth);
    
    // Crear la punta de la flecha
    const markerId = isCoreq ? 'arrow-coreq' : 'arrow-pre';
    path.setAttribute("marker-end", `url(#${markerId})`);
    
    svgCanvas.appendChild(path);
}

// Inicializar definiciones SVG para las puntas de flecha
function initSvgMarkers() {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    
    // Marker rojo para Prerrequisitos
    const markerPre = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerPre.setAttribute("id", "arrow-pre");
    markerPre.setAttribute("markerWidth", "10");
    markerPre.setAttribute("markerHeight", "10");
    markerPre.setAttribute("refX", "9");
    markerPre.setAttribute("refY", "3");
    markerPre.setAttribute("orient", "auto");
    markerPre.setAttribute("markerUnits", "strokeWidth");
    
    const prePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    prePath.setAttribute("d", "M0,0 L0,6 L9,3 z");
    prePath.setAttribute("fill", "rgba(239, 68, 68, 0.6)");
    markerPre.appendChild(prePath);
    
    // Marker naranja para Correquisitos
    const markerCoreq = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerCoreq.setAttribute("id", "arrow-coreq");
    markerCoreq.setAttribute("markerWidth", "10");
    markerCoreq.setAttribute("markerHeight", "10");
    markerCoreq.setAttribute("refX", "9");
    markerCoreq.setAttribute("refY", "3");
    markerCoreq.setAttribute("orient", "auto");
    markerCoreq.setAttribute("markerUnits", "strokeWidth");
    
    const coreqPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    coreqPath.setAttribute("d", "M0,0 L0,6 L9,3 z");
    coreqPath.setAttribute("fill", "rgba(249, 115, 22, 0.6)");
    markerCoreq.appendChild(coreqPath);
    
    defs.appendChild(markerPre);
    defs.appendChild(markerCoreq);
    svgCanvas.appendChild(defs);
}

// Boot
initSvgMarkers();
init();
