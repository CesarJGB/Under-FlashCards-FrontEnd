import { useState, useEffect, useCallback } from 'react';
import ReviewMode from './ReviewMode';
import DeckHeader from './DeckHeader';
import FlashcardCreator from './FlashcardCreator';
import CardCollectionView from './CardCollectionView';
import FastDeleteMode from './FastDeleteMode'; 
import SessionPlayer from './SessionPlayer'; 
import usePdfExport from '../hooks/usePdfExport';
import PdfExportOverlay from './PdfExportOverlay';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Modos de superficie inmersiva que no deben mostrar el DeckHeader global.
const HEADERLESS_MODES = ['continuous-review', 'normal-review', 'fast-delete'];

export default function DeckInterior({ deck, userId, authToken, onBack, initialMode = 'edit', onRefreshData, onExitToStudy, onInviteRequired }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [headerHeight, setHeaderHeight] = useState(64);
  
  const isOwner = deck.userId === userId;
  const canEdit = isOwner || deck.isDefault === true;
  const [editorView, setEditorView] = useState(() => canEdit ? 'creator' : 'collection');
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bgImage, setBgImage] = useState('');
  
  // 🎯 Alineación por defecto 'left'
  const [textAlign, setTextAlign] = useState('left');
  const [fontSize, setFontSize] = useState('text-base');
  const [showStyles, setShowStyles] = useState(false);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  // 🎯 Estilos por defecto con 'left'
  const [defaultStyles, setDefaultStyles] = useState({ bgImage: '', textAlign: 'left', fontSize: 'text-base' });
  
  const [contentImage, setContentImage] = useState('');
  const [imageSide, setImageSide] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pdfExport = usePdfExport();

  useEffect(() => { 
    if (initialMode) {
      if (!canEdit && (initialMode === 'fast-delete')) {
        setMode('edit');
      } else {
        setMode(initialMode); 
      }
    }
  }, [initialMode, canEdit]);

  const loadCards = useCallback(async ({ signal } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`, { signal });
      if (!res.ok) throw new Error('No se pudieron cargar las tarjetas.');
      const nextCards = await res.json();
      if (signal?.aborted) return false;
      setCards(nextCards);
      setCardsLoaded(true);
      return true;
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'No se pudieron cargar las tarjetas.');
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    const controller = new AbortController();
    setCards([]);
    setCardsLoaded(false);
    loadCards({ signal: controller.signal });
    return () => controller.abort();
  }, [loadCards]);

  useEffect(() => {
    setEditorView(canEdit ? 'creator' : 'collection');
  }, [deck.id, canEdit]);

  useEffect(() => {
    if (mode !== 'edit' && canEdit) setEditorView('creator');
  }, [mode, canEdit]);

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

  const handleExportPDF = async (type = 'guide') => {
    if (loading) {
      setError('Espera a que terminen de cargarse las tarjetas antes de exportar.');
      return;
    }

    await pdfExport.exportPdf({ deck, cards, type });
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

      // 🔍 HALLAZGO A: Confirmación antes de inyectar en BD
      const confirmImport = window.confirm(
        `¿Estás seguro de que deseas importar ${importedCards.length} ${importedCards.length === 1 ? 'tarjeta' : 'tarjetas'} a este mazo?`
      );
      if (!confirmImport) return;

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
            textAlign: c.textAlign || 'left',
            fontSize: c.fontSize || 'text-base',
            contentImage: c.contentImage || '',
            imageSide: c.imageSide || ''
          }))
        }),
      });

      if (!res.ok) throw new Error('Ocurrió un problema en el servidor al intentar guardar el mazo importado.');
      
      const batchData = await res.json();
      setCards((prev) => [...batchData, ...prev]); 
      
      if (typeof onRefreshData === 'function') onRefreshData();

    } catch (err) {
      setError(err.message || 'Error al procesar la lectura del archivo estructurado.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canEdit) return false;
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
        setSaving(false); return false;
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
        resetForm();
        
        if (typeof onRefreshData === 'function') onRefreshData();

        return true;
      } catch (err) { setError(err.message); return false; } finally { setSaving(false); }
    }

    if (!question.trim() || !answer.trim()) { setSaving(false); return false; }

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
        
        if (typeof onRefreshData === 'function') onRefreshData();

        return true;
      } else {
        const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, ...body }),
        });
        if (!res.ok) throw new Error('No se pudo crear.');
        const newCard = await res.json();
        setCards((prev) => [newCard, ...prev]);
        
        // 🔍 HALLAZGO B: Limpieza completa con resetForm() en lugar de reseteo parcial
        resetForm(); 
        
        if (typeof onRefreshData === 'function') onRefreshData();

        return true;
      }
    } catch (e) { 
      setError(e.message); 
      return false;
    } finally { 
      setSaving(false); 
    }
  };

  const handleEdit = (card) => {
    if (!canEdit) return;
    setIsBulk(false); setEditingId(card.id); setQuestion(card.question); setAnswer(card.answer);
    
    setTextAlign(card.textAlign || 'left'); setBgImage(card.bgImage || ''); setFontSize(card.fontSize || 'text-base');
    
    setContentImage(card.contentImage || '');
    setImageSide(card.imageSide || '');
    setEditorView('creator');
  };

  const handleDelete = async (card) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (editingId === card.id) resetForm();
      
      if (typeof onRefreshData === 'function') onRefreshData();

    } catch { /* error */ }
  };

  const handleExitSession = () => {
    if (typeof onRefreshData === 'function') {
      onRefreshData();
    }
    if (typeof onExitToStudy === 'function') {
      onExitToStudy();
    } else {
      setMode('review');
    }
  };

  const deckCardCount = Number(deck.cardCount);
  const visibleCardCount = cardsLoaded
    ? cards.length
    : Number.isFinite(deckCardCount)
      ? Math.max(0, deckCardCount)
      : cards.length;
  const isCollectionView = mode === 'edit' && editorView === 'collection';
  const isHeaderlessMode = HEADERLESS_MODES.includes(mode);
  const reserveFooterSpace = mode === 'edit' && canEdit && !isCollectionView;

  return (
    <div 
      data-testid="deck-interior" 
      className={`w-full ${reserveFooterSpace ? 'pb-28' : ''}`}
      style={!isHeaderlessMode ? { paddingTop: `${headerHeight}px` } : undefined}
    >
      <PdfExportOverlay
        isOpen={pdfExport.isExporting}
        progress={pdfExport.progress}
        onCancel={pdfExport.cancel}
      />

      {/* HEADER FIJO SUPERIOR */}
      {!isHeaderlessMode && (
        <DeckHeader 
          deck={deck} 
          mode={mode} 
          setMode={setMode} 
          onBack={onBack} 
          onExport={handleExport} 
          onExportPDF={handleExportPDF} 
          isExportingPdf={pdfExport.isExporting}
          pdfProgress={pdfExport.progress}
          pdfError={pdfExport.error}
          pdfWarnings={pdfExport.warnings}
          onCancelPdfExport={pdfExport.cancel}
          onImport={canEdit ? handleImportJSON : undefined}
          onHeightChange={setHeaderHeight}
          editorView={editorView}
          onReturnToEditor={canEdit ? () => setEditorView('creator') : onBack}
          collectionBackLabel={canEdit ? 'Volver al modo edición' : 'Volver a la biblioteca'}
        />
      )}

      {/* MODO REPASO SIMPLE */}
      {mode === 'review' && (
        <ReviewMode cards={cards} loading={loading} />
      )}

      {/* MODO REPASO CONTINUO */}
      {mode === 'continuous-review' && (
        <SessionPlayer 
          deckId={deck.id} 
          userId={userId} 
          onExit={handleExitSession} 
          mode="continuous"
        />
      )}

      {/* MODO REPASO NORMAL */}
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
        isCollectionView ? (
          <CardCollectionView
            cards={cards}
            loading={loading}
            error={error}
            onRetry={() => loadCards()}
            onEdit={canEdit ? handleEdit : undefined}
            onDelete={canEdit ? handleDelete : undefined}
          />
        ) : canEdit ? (
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
              hasCards={visibleCardCount > 0}
              cardCount={visibleCardCount}
              onOpenCollection={() => {
                setShowStyles(false);
                setEditorView('collection');
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              userId={userId}
              deckId={deck.id}
              authToken={authToken}
              onInviteRequired={onInviteRequired}
              onAiSuccess={async () => {
                await loadCards();
                if (typeof onRefreshData === 'function') onRefreshData();
              }}
            />
        ) : null
      )}
    </div>
  );
}
