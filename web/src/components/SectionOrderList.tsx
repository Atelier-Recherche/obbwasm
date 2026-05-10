import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionId } from "../bookOptions/types";
import { useI18n } from "../i18n/context";

function SortableRow({ id, label }: { id: SectionId; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="section-order-row" {...attributes} {...listeners}>
      <span className="section-order-grip" aria-hidden>
        ⋮⋮
      </span>
      <span>{label}</span>
    </div>
  );
}

type Props = {
  sectionOrder: SectionId[];
  onReorder: (next: SectionId[]) => void;
};

export function SectionOrderList({ sectionOrder, onReorder }: Props) {
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id as SectionId);
    const newIndex = sectionOrder.indexOf(over.id as SectionId);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(sectionOrder, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
        <div className="section-order-list">
          {sectionOrder.map((id) => (
            <SortableRow key={id} id={id} label={t(`sections.${id}`)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
