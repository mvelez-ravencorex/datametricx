import React, { useState, useRef, useEffect } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { PencilIcon, CheckIcon } from '@heroicons/react/24/outline'

interface EditableGridProps {
  children: React.ReactElement[]
  initialLayouts?: Layout[]
  onLayoutChange?: (layout: Layout[]) => void
}

export default function EditableGrid({
  children,
  initialLayouts,
  onLayoutChange
}: EditableGridProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [layouts, setLayouts] = useState<Layout[]>(
    initialLayouts || generateDefaultLayouts(children.length)
  )
  const [originalLayouts, setOriginalLayouts] = useState<Layout[]>([])
  const [containerWidth, setContainerWidth] = useState(1200)
  const containerRef = useRef<HTMLDivElement>(null)

  // Actualizar el ancho del contenedor dinámicamente
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Actualizar al montar
    updateWidth()

    // Actualizar al cambiar el tamaño de la ventana
    window.addEventListener('resize', updateWidth)

    return () => {
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayouts(newLayout)
    if (onLayoutChange) {
      onLayoutChange(newLayout)
    }
  }

  const toggleEditMode = () => {
    if (!isEditMode) {
      // Guardar una copia de los layouts actuales antes de entrar en modo edición
      setOriginalLayouts([...layouts])
    } else {
      // Guardar layouts en localStorage al salir del modo edición
      localStorage.setItem('dashboard-layouts', JSON.stringify(layouts))
    }
    setIsEditMode(!isEditMode)
  }

  const handleCancel = () => {
    // Restaurar los layouts originales
    setLayouts(originalLayouts)
    setIsEditMode(false)
  }

  return (
    <div className="relative">
      {/* Botones de Editar/Guardar/Cancelar */}
      <div className="fixed top-20 right-8 z-50 flex items-center space-x-3">
        {isEditMode && (
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg bg-gray-500 hover:bg-gray-600 text-white"
          >
            <span>Cancelar</span>
          </button>
        )}

        <button
          onClick={toggleEditMode}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg ${
            isEditMode
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-primary-blue hover:bg-secondary-blue text-white'
          }`}
        >
          {isEditMode ? (
            <>
              <CheckIcon className="h-5 w-5" />
              <span>Guardar</span>
            </>
          ) : (
            <>
              <PencilIcon className="h-5 w-5" />
              <span>Editar Dashboard</span>
            </>
          )}
        </button>
      </div>

      {/* Indicador de modo edición */}
      {isEditMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">
            🎨 <strong>Modo Edición Activo:</strong> Arrastra y redimensiona los elementos.
            Haz clic en "Guardar" cuando termines.
          </p>
        </div>
      )}

      {/* Grid Layout */}
      <div ref={containerRef} className={`relative ${isEditMode ? 'edit-mode-grid' : ''}`}>
        <GridLayout
          className={`layout ${isEditMode ? 'editing' : ''}`}
          layout={layouts}
          cols={12}
          rowHeight={100}
          width={containerWidth}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          compactType={null}
          preventCollision={false}
        >
          {children.map((child, index) => {
            return (
              <div key={layouts[index]?.i || `item-${index}`}>
                <div className={`widget-wrapper ${isEditMode ? 'editing' : ''}`}>
                  {isEditMode && (
                    <div className="drag-handle cursor-move bg-blue-500 text-white px-2 py-1 text-xs rounded-t-lg flex items-center justify-between">
                      <span>⋮⋮ Arrastra aquí</span>
                      <span className="text-xs opacity-75">
                        {layouts[index]?.w}x{layouts[index]?.h}
                      </span>
                    </div>
                  )}
                  {child}
                </div>
              </div>
            )
          })}
        </GridLayout>
      </div>

      {/* Grid visual en modo edición */}
      {isEditMode && (
        <style>{`
          .edit-mode-grid {
            position: relative;
          }
          .edit-mode-grid::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image:
              repeating-linear-gradient(0deg, rgba(59, 130, 246, 0.1) 0px, rgba(59, 130, 246, 0.1) 1px, transparent 1px, transparent 100px),
              repeating-linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0px, rgba(59, 130, 246, 0.1) 1px, transparent 1px, transparent 100px);
            pointer-events: none;
            z-index: 1;
          }
          .widget-wrapper.editing {
            border: 2px dashed rgba(59, 130, 246, 0.5);
            border-radius: 8px;
            transition: all 0.2s;
          }
          .widget-wrapper.editing:hover {
            border-color: rgba(59, 130, 246, 0.8);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
          }
          .react-grid-item.react-grid-placeholder {
            background: rgba(59, 130, 246, 0.2);
            border-radius: 8px;
            border: 2px dashed rgba(59, 130, 246, 0.5);
          }
          .react-grid-item.react-draggable-dragging {
            opacity: 0.8;
            z-index: 100;
          }
          .react-resizable-handle {
            background: rgba(59, 130, 246, 0.5);
            border-radius: 50%;
          }
          .react-resizable-handle::after {
            border-color: white !important;
          }
        `}</style>
      )}
    </div>
  )
}

// Función para generar layouts por defecto
function generateDefaultLayouts(count: number): Layout[] {
  const layouts: Layout[] = []

  // KPI Cards (3 columnas, 1 fila cada una)
  for (let i = 0; i < 3 && i < count; i++) {
    layouts.push({
      i: `item-${i}`,
      x: i * 4,
      y: 0,
      w: 4,
      h: 2,
    })
  }

  // Quarterly Sales (2/3 ancho)
  if (count > 3) {
    layouts.push({
      i: `item-3`,
      x: 0,
      y: 2,
      w: 8,
      h: 3,
    })
  }

  // Connected Sources (1/3 ancho)
  if (count > 4) {
    layouts.push({
      i: `item-4`,
      x: 8,
      y: 2,
      w: 4,
      h: 3,
    })
  }

  // Sales Forecast (2/3 ancho)
  if (count > 5) {
    layouts.push({
      i: `item-5`,
      x: 0,
      y: 5,
      w: 8,
      h: 3,
    })
  }

  // Product Category (1/3 ancho)
  if (count > 6) {
    layouts.push({
      i: `item-6`,
      x: 8,
      y: 5,
      w: 4,
      h: 3,
    })
  }

  // Top Products (ancho completo)
  if (count > 7) {
    layouts.push({
      i: `item-7`,
      x: 0,
      y: 8,
      w: 12,
      h: 3,
    })
  }

  return layouts
}
