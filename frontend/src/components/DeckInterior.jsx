import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, Eye } from 'lucide-react'; 
import ReviewMode from './ReviewMode';
import DeckHeader from './DeckHeader';
import FlashcardCreator from './FlashcardCreator';
import FlashcardCollection from './FlashcardCollection'; 
import FastDeleteMode from './FastDeleteMode'; 
import StudyMethodsZone from './StudyMethodsZone'; 
import SessionPlayer from './SessionPlayer'; 
import { exportDeckToPDF } from '../utils/pdfExporter'; 

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Modos que corresponden a una sesión de estudio activa (SessionPlayer).
// Centralizado acá para no tener que acordarse de actualizar cada `mode !== '...'`
// suelto si en el futuro se agrega un tercer modo de sesión: solo se agrega aquí.
const SESSION_MODES = ['continuous-review', 'normal-review'];

export default function DeckInterior({ deck, userId, onBack, initialMode = 'edit', onRefreshData }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(initialMode);
  
  const isOwner = deck.userId === userId;
  const canEdit = isOwner || deck.isDefault === true;
  const [showGrid, setShowGrid] = useState(() => !canEdit);
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [textAlign, setTextAlign] = useState('center');
  const [fontSize, setFontSize] = useState('text-base');
  const [showStyles, setShowStyles] = useState(false);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [defaultStyles, setDefaultStyles] = useState({ bgImage: '', textAlign: 'center', fontSize: 'text-base' });
  
  const [contentImage, setContentImage] = useState('');
  const [imageSide, setImageSide] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { 
    if (initialMode) {
      if (!canEdit && (initialMode === 'fast-delete')) {
        setMode('edit');
      } else {
        setMode(initialMode); 
      }
    }
  }, [initialMode, canEdit]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`);
      if (!res.ok) throw new Error('No se pudieron cargar las tarjetas.');
      setCards(await res.json());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [deck.id]);

  useEffect(() => { loadCards(); }, [loadCards]);

  useEffect(() => {
    if (editingId === null) setDefaultStyles({ bgImage, textAlign, fontSize });
  }, [bgImage, textAlign, fontSize, editingId]);

  const resetForm = () => {
    setQuestion(''); setAnswer(''); setBulkText('');
    setBgImage(defaultStyles.bgImage); setTextAlign(defaultStyles.textAlign);
    setFontSize(defaultStyles.fontSize); setEditingId(null);
    setContentImage(''); setImageSide(''); 
  };

  const handleExport = async () => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}/export`);
      if (!res.ok) throw new Error('No se pudo exportar el mazo.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck.title || 'mazo').replace(/[^\w\s-]/g, '').trim() || 'mazo'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const handleExportPDF = (type = 'guide') => {
    if (cards.length === 0) {
      setError('No hay tarjetas en este mazo para exportar a PDF.');
      return;
    }
    setError('');
    exportDeckToPDF(deck.title, cards, type);
  };

  const handleImportJSON = async (file) => {
    if (!canEdit) return;
    setError('');
    try {
      const text = await file.text();
      const parsedData = JSON.parse(text);
      const importedCards = Array.isArray(parsedData) ? parsedData : (parsedData.cards || []);

      if (importedCards.length === 0) {
        throw new Error('El archivo JSON seleccionado no contiene un lote de tarjetas estructurado.');
      }

      setSaving(true);
      const res = await fetch(`${BACKEND_URL}/api/flashcards/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deckId: deck.id,
          batchStyles: { bgImage, textAlign, fontSize },
          cards: importedCards.map((c) => ({
            question: c.question || 'Pregunta vacía',
            answer: c.answer || 'Respuesta vacía',
            bgImage: c.bgImage || '',
            textAlign: c.textAlign || 'center',
            fontSize: c.fontSize || 'text-base',
            contentImage: c.contentImage || '',
            imageSide: c.imageSide || ''
          }))
        }),
      });

      if (!res.ok) throw new Error('Ocurrió un problema en el servidor al intentar guardar el mazo importado.');
      
      const batchData = await res.json();
      setCards((prev) => [...batchData, ...prev]); 
      
      // 🚀 Sincronizar recuento global tras importación externa exitosa
      if (typeof onRefreshData === 'function') onRefreshData();

    } catch (err) {
      setError(err.message || 'Error al procesar la lectura del archivo estructurado.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');

    if (isBulk && !editingId) {
      const lines = bulkText.split('\n');
      const parsedCards = [];
      let currentQuestion = '';

      lines.forEach((line) => {
        const cleanLine = line.trim();
        if (/^[pP]\s*:/i.test(cleanLine)) currentQuestion = cleanLine.replace(/^[pP]\s*:/i, '').trim();
        else if (/^[rR]\s*:/i.test(cleanLine)) {
          const currentAnswer = cleanLine.replace(/^[rR]\s*:/i, '').trim();
          if (currentQuestion && currentAnswer) {
            parsedCards.push({ question: currentQuestion, answer: currentAnswer });
            currentQuestion = '';
          }
        }
      });

      if (parsedCards.length === 0) {
        setError('No se encontraron bloques válidos (P: ... R: ...)');
        setSaving(false); return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, batchStyles: { bgImage, textAlign, fontSize }, cards: parsedCards }),
        });
        if (!res.ok) throw new Error('No se pudo guardar el lote.');
        const batchData = await res.json();
        setCards((prev) => [...batchData, ...prev]);
        resetForm(); setIsBulk(false);
        
        // 🚀 Sincronizar recuento tras guardar un lote manual por texto
        if (typeof onRefreshData === 'function') onRefreshData();

      } catch (err) { setError(err.message); } finally { setSaving(false); }
      return;
    }

    if (!question.trim() || !answer.trim()) { setSaving(false); return; }

    const body = { question, answer, bgImage, textAlign, fontSize, contentImage, imageSide };

    try {
      if (editingId) {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('No se pudo actualizar.');
        const updated = await res.json();
        setCards((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        resetForm(); 
        
        // 🚀 Sincronizar cambios por si mutaron métricas de estilo o contenido
        if (typeof onRefreshData === 'function') onRefreshData();

      } else {
        const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, ...body }),
        });
        if (!res.ok) throw new Error('No se pudo crear.');
        const newCard = await res.json();
        setCards((prev) => [newCard, ...prev]);
        
        setQuestion(''); 
        setAnswer('');
        setContentImage(''); 
        setImageSide(''); 
        
        // 🚀 Sincronizar incremento en el contador de tarjetas del mazo
        if (typeof onRefreshData === 'function') onRefreshData();
      }
    } catch (e) { 
      setError(e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleEdit = (card) => {
    if (!canEdit) return;
    setIsBulk(false); setEditingId(card.id); setQuestion(card.question); setAnswer(card.answer);
    setBgImage(card.bgImage || ''); setTextAlign(card.textAlign || 'center'); setFontSize(card.fontSize || 'text-base');
    setContentImage(card.contentImage || '');
    setImageSide(card.imageSide || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowGrid(true);
  };

  const handleDelete = async (card) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (editingId === card.id) resetForm();
      
      // 🚀 Sincronizar decremento de tarjeta en los contadores globales
      if (typeof onRefreshData === 'function') onRefreshData();

    } catch { /* error */ }
  };

  // Handler para limpiar la sesión de estudio (cualquiera de los modos) y
  // forzar el refresco de métricas en paralelo
  const handleExitSession = () => {
    setMode('review');
    if (typeof onRefreshData === 'function') {
      onRefreshData();
    }
  };

  const isSessionMode = SESSION_MODES.includes(mode);
console.log('DEBUG mode actual:', mode, '| isSessionMode:', isSessionMode);
  
  return (
    <div data-testid="deck-interior">
      {/* Ocultamos el header nativo durante cualquier sesión activa (continuo o normal) para máxima inmersión */}
      {!isSessionMode && (
        <DeckHeader 
          deck={deck} 
          mode={mode} 
          setMode={setMode} 
          onBack={onBack} 
          onExport={handleExport} 
          onExportPDF={handleExportPDF} 
          onImport={canEdit ? handleImportJSON : undefined} 
        />
      )}

      {/* 🧭 MODO ZONA DE MÉTODOS */}
      {mode === 'review' && (
        <StudyMethodsZone onSelectMethod={(methodId) => setMode(`${methodId}-review`)} />
      )}

      {/* 🕹️ MODO REPASO CONTINUO (Bucle Inteligente) */}
      {mode === 'continuous-review' && (
        <SessionPlayer 
          deckId={deck.id} 
          userId={userId} 
          onExit={handleExitSession} 
          mode="continuous"
        />
      )}

      {/* 📖 MODO REPASO NORMAL (Mazo completo, sin ponderación) */}
      {mode === 'normal-review' && (
        <SessionPlayer 
          deckId={deck.id} 
          userId={userId} 
          onExit={handleExitSession} 
          mode="normal"
        />
      )}

      {mode === 'fast-delete' && canEdit && (
        <FastDeleteMode 
          cards={cards} 
          onDelete={handleDelete} 
          onClose={() => setMode('edit')} 
        />
      )}

      {mode === 'edit' && (
        <>
          {canEdit ? (
            <FlashcardCreator
              question={question} setQuestion={setQuestion} answer={answer} setAnswer={setAnswer}
              bgImage={bgImage} setBgImage={setBgImage} textAlign={textAlign} setTextAlign={setTextAlign}
              fontSize={fontSize} setFontSize={setFontSize} showStyles={showStyles} setShowStyles={setShowStyles}
              isBulk={isBulk} setIsBulk={setIsBulk} bulkText={bulkText} setBulkText={setBulkText}
              editingId={editingId} saving={saving} error={error} setError={setError}
              onSubmit={handleSubmit} onCancel={resetForm}
              contentImage={contentImage} setContentImage={setContentImage}
              imageSide={imageSide} setImageSide={setImageSide}
              onFastDelete={() => setMode('fast-delete')}
              hasCards={(deck.cardCount ?? cards.length) > 0}
              userId={userId}
              deckId={deck.id}
              onAiSuccess={(newCards) => {
                setCards((prev) => [...newCards, ...prev]);
                // 🚀 Sincronizar contadores globales tras inyectar tarjetas con IA
                if (typeof onRefreshData === 'function') onRefreshData();
              }}
            />
          ) : (
            <div className="bg-blue-50/60 border border-blue-200/50 rounded-2xl p-4 flex items-center gap-3.5 text-blue-800 text-xs font-semibold shadow-3xs animate-[fadeIn_0.15s_ease] mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                <Eye className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="flex-1">
                <p className="text-blue-950 font-bold text-sm">Plantilla Protegida de Solo Lectura</p>
                <p className="text-blue-600/90 font-medium mt-0.5">Estás explorando un mazo oficial configurado en modo consulta. Puedes ver y repasar todas sus tarjetas libremente, pero no se permiten modificaciones.</p>
              </div>
            </div>
          )}
          
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className="mt-6 w-full flex items-center justify-between bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl px-5 py-3.5 transition-colors shadow-xs active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Colección de tarjetas del mazo
              </h3>
              
              <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/50 inline-flex items-center gap-1.5 h-5">
                {loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-400 shrink-0" />}
                <span>
                  {cards.length > 0 
                    ? `${cards.length} ${cards.length === 1 ? 'tarjeta' : 'tarjetas'}`
                    : `${deck.cardCount ?? 0} ${deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}`
                  }
                </span>
              </span>
            </div>
            {showGrid ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showGrid && (
            <div className="animate-[fadeIn_0.18s_ease] pb-6">
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-slate-400 py-8 text-xs font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> Sincronizando colección…
                </div>
              ) : (
                <FlashcardCollection 
                  cards={cards} 
                  onEdit={canEdit ? handleEdit : undefined} 
                  onDelete={canEdit ? handleDelete : undefined} 
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
