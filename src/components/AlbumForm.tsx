type AlbumFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  album?: {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    eventDate: Date | null;
  };
};

function dateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function AlbumForm({ action, submitLabel, album }: AlbumFormProps) {
  return (
    <form action={action} className="form-grid">
      {album ? <input type="hidden" name="albumId" value={album.id} /> : null}
      <label>
        标题
        <input name="title" defaultValue={album?.title ?? ""} required />
      </label>
      <label>
        日期
        <input name="eventDate" type="date" defaultValue={dateInput(album?.eventDate)} />
      </label>
      <label>
        封面地址
        <input name="coverUrl" defaultValue={album?.coverUrl ?? ""} placeholder="可先留空" />
      </label>
      <label>
        描述
        <textarea name="description" defaultValue={album?.description ?? ""} />
      </label>
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
