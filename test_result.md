#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: "La creación de un examen con IA falla para el mazo Esme Notas de 114 tarjetas al seleccionar 100 preguntas."
## backend:
##   - task: "Generación de 100 preguntas con IA desde un mazo"
##     implemented: true
##     working: true
##     file: "backend/src/controllers/examController.js"
##     stuck_count: 2
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         - working: false
##           agent: "user"
##           comment: "El usuario reportó una cantidad o formato inválido al generar desde Esme Notas."
##         - working: "NA"
##           agent: "main"
##           comment: "El mazo 6a5835f1e15fd1e9f56b320b se verificó con 114 tarjetas completas. La generación ahora procesa lotes de 10 y conserva sourceIndex global."
##         - working: true
##           agent: "main"
##           comment: "Prueba real completada: HTTP 201, 100 preguntas generadas y 100 persistidas; el examen temporal se eliminó al finalizar."
##         - working: "NA"
##           agent: "main"
##           comment: "Se añadió emisión de progreso por lotes para la generación con IA; pendiente de verificación."
##         - working: true
##           agent: "main"
##           comment: "Prueba SSE real aprobada: eventos 0/1 y 1/1, finalización confirmada y pregunta persistida; el examen temporal se eliminó."
##         - working: false
##           agent: "user"
##           comment: "Una generación real de 100 preguntas se detuvo cerca de 40 con un error genérico."
##         - working: "NA"
##           agent: "main"
##           comment: "Se añadieron reintentos, timeout, heartbeats SSE y trazas correlacionadas por lote; pendiente de pruebas controladas."
##         - working: true
##           agent: "main"
##           comment: "Se verificó un 429 simulado en el segundo lote: el primero quedó persistido, el SSE informó el avance parcial y la respuesta segura incluyó la referencia de ejecución."
## frontend:
##   - task: "Límite visible de preguntas por mazo"
##     implemented: true
##     working: true
##     file: "frontend/src/components/exams/ExamCreationWizard.jsx"
##     stuck_count: 1
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         - working: false
##           agent: "user"
##           comment: "El usuario reportó que 100 preguntas se marcaba como inválido."
##         - working: "NA"
##           agent: "main"
##           comment: "El campo numérico ahora no permite exceder el límite total de 100 preguntas."
##         - working: true
##           agent: "main"
##           comment: "La compilación de producción de Vite terminó correctamente."
##   - task: "Indicador de progreso de generación con IA"
##     implemented: true
##     working: true
##     file: "frontend/src/components/exams/ExamCreationWizard.jsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         - working: "NA"
##           agent: "main"
##           comment: "La pantalla consume eventos SSE y muestra preguntas completadas sobre el total."
##         - working: true
##           agent: "main"
##           comment: "La compilación de producción y la prueba SSE del backend finalizaron correctamente."
##   - task: "Progreso y optimización de IA para mazos"
##     implemented: true
##     working: true
##     file: "backend/src/controllers/flashcardController.js"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         - working: "NA"
##           agent: "main"
##           comment: "La generación de mazos ahora procesa lotes, emite SSE real y limita texto/sobreproducción; pendiente de verificación."
##         - working: true
##           agent: "main"
##           comment: "Prueba real aprobada: cuatro eventos SSE, una tarjeta persistida y limpieza posterior del mazo temporal."
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 5
##   run_ui: false
## test_plan:
##   current_focus:
##     - "Observar trazas temporales de IA en Render durante el siguiente intento de 100 preguntas"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"
## agent_communication:
##   - agent: "main"
##     message: "Pruebas de reintento, recuperación parcial, stream de examen y stream de mazo aprobadas. Las trazas [ai] quedan activas temporalmente para el siguiente intento real."
