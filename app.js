// Estado global
const coursesByName = {};
const courseStates = JSON.parse(localStorage.getItem('malla_course_states') || '{}');
let showFlow = false;
let totalCarreraUC = 0;

// Utilidades
const slugify = (text) => text.toLowerCase().replace(/[\s\W-]+/g, '-');

// Nodos principales
const container = document.getElementById('malla');
const ucTracker = document.getElementById('ucTracker');
const tooltip = document.getElementById('subjectTooltip');
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
}

function checkPrerequisites(course) {
    if (!course.prelaciones) return true;
    
    // Calcular UC aprobadas temporalmente (aunque updateGlobalStats lo hace global, aquí lo hacemos rápido)
    let aprobadaUC = 0;
    Object.keys(courseStates).forEach(nombre => {
        const c = coursesByName[nombre];
        if(c && courseStates[nombre] === 'aprobada') {
            aprobadaUC += parseInt(c.uc) || 0;
        }
    });

    for (let pre of course.prelaciones) {
        if (pre.tipo === 'materia') {
            const preState = courseStates[pre.valor] || 'none';
            if (pre.correquisito) {
                if (preState !== 'aprobada' && preState !== 'cursando') {
                    return false;
                }
            } else {
                if (preState !== 'aprobada') {
                    return false;
                }
            }
        } else if (pre.tipo === 'UC') {
            if (aprobadaUC < parseInt(pre.valor)) {
                return false;
            }
        }
    }
    return true;
}

function updateCardVisuals(course, cardElement) {
    // Reset classes
    cardElement.classList.remove('is-passed', 'is-cursando', 'is-invalid');
    
    const state = courseStates[course.nombre];
    if (state === 'aprobada' || state === 'cursando') {
        const hasReqs = checkPrerequisites(course);
        if (!hasReqs) {
            cardElement.classList.add('is-invalid');
        } else {
            if (state === 'aprobada') cardElement.classList.add('is-passed');
            if (state === 'cursando') cardElement.classList.add('is-cursando');
        }
    }
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
            card.id = course.elementId;
            
            updateCardVisuals(course, card);
            
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
    const currentState = courseStates[nombre] || 'none';
    const course = coursesByName[nombre];
    
    // Ciclo: none -> cursando -> aprobada -> none
    if (currentState === 'none') {
        courseStates[nombre] = 'cursando';
    } else if (currentState === 'cursando') {
        courseStates[nombre] = 'aprobada';
    } else {
        delete courseStates[nombre];
    }
    
    // Update visuals for ALL cards because UC or prerequisites might have changed for other courses
    Object.keys(coursesByName).forEach(cName => {
        const cEl = document.getElementById(coursesByName[cName].elementId);
        if(cEl) updateCardVisuals(coursesByName[cName], cEl);
    });
    
    localStorage.setItem('malla_course_states', JSON.stringify(courseStates));
    updateGlobalStats();
}

function updateGlobalStats() {
    let cursandoUC = 0;
    let aprobadaUC = 0;
    
    Object.keys(courseStates).forEach(nombre => {
        const course = coursesByName[nombre];
        if(course) {
            if(courseStates[nombre] === 'cursando') {
                cursandoUC += parseInt(course.uc) || 0;
            } else if (courseStates[nombre] === 'aprobada') {
                aprobadaUC += parseInt(course.uc) || 0;
            }
        }
    });
    
    let percent = ((aprobadaUC / totalCarreraUC) * 100).toFixed(1);
    globalUCElement.innerHTML = `<span style="color:#10b981">${aprobadaUC} UC Aprobadas (${percent}%)</span> | <span style="color:#3b82f6">${cursandoUC} UC Cursando</span>`;
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
init();
