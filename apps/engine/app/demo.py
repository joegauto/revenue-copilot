"""Página demo interactiva para probar Revenue Copilot."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

demo_router = APIRouter(tags=["demo"])

DEMO_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Revenue Copilot — Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .chat-bubble { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-4xl">
        <!-- Header -->
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-white">🚀 Revenue Copilot</h1>
            <p class="text-gray-400 mt-2">Agente comercial IA autónomo — Demo en vivo</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Chat -->
            <div class="lg:col-span-2 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
                <div class="bg-indigo-600 p-4 text-white">
                    <h2 class="font-bold">💬 Chat con el Agente IA</h2>
                    <p class="text-xs text-indigo-200">Simulá ser un lead — escribí cualquier consulta comercial</p>
                </div>
                <div id="messages" class="flex-1 overflow-y-auto p-4 space-y-3">
                    <div class="chat-bubble bg-indigo-50 p-3 rounded-lg rounded-tl-none max-w-[80%] text-sm">
                        ¡Hola! Soy el agente comercial de Revenue Copilot. ¿En qué puedo ayudarte hoy?
                    </div>
                </div>
                <div class="border-t p-3 flex gap-2">
                    <input id="input" type="text" placeholder="Escribí tu mensaje..."
                        class="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        onkeydown="if(event.key==='Enter')sendMessage()">
                    <button onclick="sendMessage()"
                        class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                        Enviar
                    </button>
                </div>
            </div>

            <!-- Scoring Panel -->
            <div class="space-y-4">
                <div class="bg-white rounded-2xl shadow-xl p-5">
                    <h3 class="font-bold text-gray-800 mb-3">📊 Lead Score</h3>
                    <div class="text-center">
                        <div id="score" class="text-5xl font-bold text-indigo-600">0</div>
                        <div class="text-sm text-gray-500 mt-1">/ 100</div>
                        <div id="score-bar" class="mt-3 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div id="score-fill" class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: 0%"></div>
                        </div>
                    </div>
                    <div id="status-badge" class="mt-3 text-center">
                        <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Nuevo</span>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-xl p-5">
                    <h3 class="font-bold text-gray-800 mb-3">🎯 Dimensiones</h3>
                    <div id="dimensions" class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-600">Calificación</span><span class="font-medium">0</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Engagement</span><span class="font-medium">0</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Demografía</span><span class="font-medium">0</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Vel. Respuesta</span><span class="font-medium">0</span></div>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-xl p-5">
                    <h3 class="font-bold text-gray-800 mb-3">🏷️ Intent</h3>
                    <div id="intent" class="text-sm text-gray-600">—</div>
                    <div id="action" class="mt-2 text-sm text-green-600 font-medium hidden"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let messageCount = 0;
        let currentScore = 0;

        async function sendMessage() {
            const input = document.getElementById('input');
            const msg = input.value.trim();
            if (!msg) return;
            input.value = '';
            messageCount++;

            // Mostrar mensaje del usuario
            addMessage(msg, 'user');

            // Mostrar typing
            const typingId = addMessage('Escribiendo...', 'typing');

            try {
                const response = await fetch('/engine/process-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: 'demo-tenant',
                        lead_id: 'demo-lead',
                        conversation_id: 'demo-conv',
                        channel: 'webchat',
                        message: msg,
                        history: [],
                        lead_context: {
                            status: currentScore >= 60 ? 'qualified' : 'in_progress',
                            qualification_answers: Math.min(messageCount, 5),
                            total_questions: 5,
                            total_messages: messageCount,
                            matching_fields: Math.min(Math.floor(messageCount / 2), 5),
                            total_fields: 5,
                            avg_response_time_minutes: 2,
                            current_score: currentScore,
                        },
                        tenant_config: { qualification_threshold: 60 },
                    }),
                });

                const data = await response.json();

                // Quitar typing
                document.getElementById(typingId)?.remove();

                // Mostrar respuesta del agente
                addMessage(data.response, 'agent');

                // Actualizar score
                currentScore = data.score || 0;
                updateScorePanel(data);

            } catch (err) {
                document.getElementById(typingId)?.remove();
                addMessage('Error de conexión. ¿El engine está corriendo?', 'error');
            }
        }

        function addMessage(text, type) {
            const container = document.getElementById('messages');
            const id = 'msg-' + Date.now() + Math.random();
            const div = document.createElement('div');
            div.id = id;
            div.className = 'chat-bubble max-w-[80%] p-3 rounded-lg text-sm';

            if (type === 'user') {
                div.className += ' bg-indigo-600 text-white ml-auto rounded-br-none';
            } else if (type === 'agent') {
                div.className += ' bg-indigo-50 text-gray-800 rounded-tl-none';
            } else if (type === 'typing') {
                div.className += ' bg-gray-100 text-gray-400 italic rounded-tl-none';
            } else {
                div.className += ' bg-red-50 text-red-600 rounded-tl-none';
            }

            div.textContent = text;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            return id;
        }

        function updateScorePanel(data) {
            document.getElementById('score').textContent = data.score || 0;
            document.getElementById('score-fill').style.width = (data.score || 0) + '%';

            // Color del score
            const scoreEl = document.getElementById('score');
            if (data.score >= 60) scoreEl.className = 'text-5xl font-bold text-green-600';
            else if (data.score >= 30) scoreEl.className = 'text-5xl font-bold text-yellow-600';
            else scoreEl.className = 'text-5xl font-bold text-indigo-600';

            // Status badge
            const badge = document.getElementById('status-badge');
            if (data.metadata?.qualified) {
                badge.innerHTML = '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Calificado</span>';
            } else {
                badge.innerHTML = '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">En progreso</span>';
            }

            // Dimensiones
            const dims = data.metadata?.dimension_scores || {};
            document.getElementById('dimensions').innerHTML = `
                <div class="flex justify-between"><span class="text-gray-600">Calificación</span><span class="font-medium">${dims.qualification || 0}</span></div>
                <div class="flex justify-between"><span class="text-gray-600">Engagement</span><span class="font-medium">${dims.engagement || 0}</span></div>
                <div class="flex justify-between"><span class="text-gray-600">Demografía</span><span class="font-medium">${dims.demographics || 0}</span></div>
                <div class="flex justify-between"><span class="text-gray-600">Vel. Respuesta</span><span class="font-medium">${dims.response_speed || 0}</span></div>
            `;

            // Intent
            document.getElementById('intent').textContent = data.intent || '—';

            // Acción
            const actionEl = document.getElementById('action');
            if (data.action) {
                actionEl.textContent = '⚡ Acción: ' + data.action;
                actionEl.classList.remove('hidden');
            } else {
                actionEl.classList.add('hidden');
            }
        }
    </script>
</body>
</html>
"""


@demo_router.get("/", response_class=HTMLResponse)
async def demo_page():
    """Página demo interactiva."""
    return DEMO_HTML


@demo_router.get("/demo", response_class=HTMLResponse)
async def demo_page_alt():
    """Alias de la demo."""
    return DEMO_HTML
