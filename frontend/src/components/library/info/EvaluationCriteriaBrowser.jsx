import React, { useMemo } from 'react';
import EvaluationFolderView from './EvaluationFolderView';
import { computeAccumulatedPercent } from '../../../lib/evaluationUtils';

export default function EvaluationCriteriaBrowser({
  evaluationTree = [],
  targetGrade = 70,
  navStack = [],
  onNavStackChange = () => {},
  readOnly = false,
  onAdd = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onChangeGrade = () => {},
  onUpdateTargetGrade
}) {
  const currentNode = useMemo(() => {
    if (!navStack.length) return { children: evaluationTree };

    let node = { children: evaluationTree };
    for (const id of navStack) {
      node = (node.children || []).find((child) => (child.id || child._id) === id) || { children: [] };
    }

    return node;
  }, [evaluationTree, navStack]);

  const rootSum = useMemo(
    () => (evaluationTree || []).reduce((acc, node) => acc + (node.weight || 0), 0),
    [evaluationTree]
  );

  const accumulated = useMemo(
    () => computeAccumulatedPercent({ type: 'folder', children: evaluationTree }),
    [evaluationTree]
  );

  const handleOpenFolder = (node) => {
    onNavStackChange((prev) => [...prev, node.id || node._id]);
  };

  const handleBackFolder = () => {
    onNavStackChange((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      {navStack.length > 0 && (
        <div>
          <button
            type="button"
            onClick={handleBackFolder}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            ← Atrás
          </button>
        </div>
      )}

      <EvaluationFolderView
        nodes={currentNode.children || []}
        globalProgress={accumulated || 0}
        targetGrade={targetGrade}
        rootSum={rootSum}
        isRoot={navStack.length === 0}
        readOnly={readOnly}
        onAdd={onAdd}
        onOpenFolder={handleOpenFolder}
        onEdit={onEdit}
        onDelete={onDelete}
        onChangeGrade={onChangeGrade}
        onUpdateTargetGrade={onUpdateTargetGrade}
      />
    </div>
  );
}
