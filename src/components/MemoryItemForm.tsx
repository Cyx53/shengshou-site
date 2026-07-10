type MemoryItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  albumId?: string;
  item?: {
    id: string;
    title: string;
    description: string | null;
    takenAt: Date | null;
  };
  includeFile?: boolean;
};

function dateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function MemoryItemForm({
  action,
  submitLabel,
  albumId,
  item,
  includeFile = false,
}: MemoryItemFormProps) {
  return (
    <form action={action} className="form-grid" encType="multipart/form-data">
      {albumId ? <input type="hidden" name="albumId" value={albumId} /> : null}
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <label>
        标题
        <input name="title" defaultValue={item?.title ?? ""} />
      </label>
      <label>
        拍摄日期
        <input name="takenAt" type="date" defaultValue={dateInput(item?.takenAt)} />
      </label>
      {includeFile ? (
        <label>
          文件
          <input name="file" type="file" accept="image/*,video/*" required />
        </label>
      ) : null}
      <label>
        描述
        <textarea name="description" defaultValue={item?.description ?? ""} />
      </label>
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
