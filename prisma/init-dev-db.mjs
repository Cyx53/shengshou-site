import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "dev.db");

mkdirSync(__dirname, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id TEXT NOT NULL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS Post (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  coverUrl TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  section TEXT NOT NULL DEFAULT 'BLOG',
  authorId TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT Post_authorId_fkey FOREIGN KEY (authorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS MemoryAlbum (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  coverUrl TEXT,
  eventDate DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS MemoryItem (
  id TEXT NOT NULL PRIMARY KEY,
  albumId TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mediaUrl TEXT NOT NULL,
  thumbnailUrl TEXT,
  takenAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT MemoryItem_albumId_fkey FOREIGN KEY (albumId) REFERENCES MemoryAlbum (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Book (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  coverUrl TEXT,
  fileUrl TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'OTHER',
  sourceUrl TEXT,
  uploaderId TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT Book_uploaderId_fkey FOREIGN KEY (uploaderId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS BookChapter (
  id TEXT NOT NULL PRIMARY KEY,
  bookId TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  locator TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT BookChapter_bookId_fkey FOREIGN KEY (bookId) REFERENCES Book (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ReadingRecord (
  id TEXT NOT NULL PRIMARY KEY,
  bookId TEXT NOT NULL,
  userId TEXT NOT NULL,
  chapterId TEXT,
  parentRecordId TEXT,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  quote TEXT,
  locator TEXT,
  pageNumber INTEGER,
  annotationStyle TEXT,
  color TEXT,
  rects TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT ReadingRecord_bookId_fkey FOREIGN KEY (bookId) REFERENCES Book (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ReadingRecord_userId_fkey FOREIGN KEY (userId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ReadingRecord_chapterId_fkey FOREIGN KEY (chapterId) REFERENCES BookChapter (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ReadingRecord_parentRecordId_fkey FOREIGN KEY (parentRecordId) REFERENCES ReadingRecord (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS CreativeWork (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  synopsis TEXT,
  coverUrl TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  authorId TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT CreativeWork_authorId_fkey FOREIGN KEY (authorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS CreativeChapter (
  id TEXT NOT NULL PRIMARY KEY,
  workId TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT CreativeChapter_workId_fkey FOREIGN KEY (workId) REFERENCES CreativeWork (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Comment (
  id TEXT NOT NULL PRIMARY KEY,
  authorId TEXT NOT NULL,
  body TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targetId TEXT NOT NULL,
  parentId TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  CONSTRAINT Comment_authorId_fkey FOREIGN KEY (authorId) REFERENCES User (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT Comment_parentId_fkey FOREIGN KEY (parentId) REFERENCES Comment (id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS Post_authorId_idx ON Post(authorId);
CREATE INDEX IF NOT EXISTS MemoryItem_albumId_idx ON MemoryItem(albumId);
CREATE INDEX IF NOT EXISTS Book_format_idx ON Book(format);
CREATE INDEX IF NOT EXISTS Book_uploaderId_idx ON Book(uploaderId);
CREATE INDEX IF NOT EXISTS BookChapter_bookId_position_idx ON BookChapter(bookId, position);
CREATE INDEX IF NOT EXISTS ReadingRecord_bookId_kind_idx ON ReadingRecord(bookId, kind);
CREATE INDEX IF NOT EXISTS ReadingRecord_userId_idx ON ReadingRecord(userId);
CREATE INDEX IF NOT EXISTS ReadingRecord_chapterId_idx ON ReadingRecord(chapterId);
CREATE INDEX IF NOT EXISTS CreativeWork_authorId_idx ON CreativeWork(authorId);
CREATE INDEX IF NOT EXISTS CreativeChapter_workId_position_idx ON CreativeChapter(workId, position);
CREATE INDEX IF NOT EXISTS Comment_targetType_targetId_idx ON Comment(targetType, targetId);
CREATE INDEX IF NOT EXISTS Comment_parentId_idx ON Comment(parentId);
`);

const postColumns = db.prepare("PRAGMA table_info(Post)").all();
if (!postColumns.some((column) => column.name === "section")) {
  db.exec("ALTER TABLE Post ADD COLUMN section TEXT NOT NULL DEFAULT 'BLOG';");
}
db.exec("CREATE INDEX IF NOT EXISTS Post_section_status_idx ON Post(section, status);");

const readingRecordColumns = db.prepare("PRAGMA table_info(ReadingRecord)").all();
if (!readingRecordColumns.some((column) => column.name === "pageNumber")) {
  db.exec("ALTER TABLE ReadingRecord ADD COLUMN pageNumber INTEGER;");
}
if (!readingRecordColumns.some((column) => column.name === "parentRecordId")) {
  db.exec("ALTER TABLE ReadingRecord ADD COLUMN parentRecordId TEXT;");
}
if (!readingRecordColumns.some((column) => column.name === "annotationStyle")) {
  db.exec("ALTER TABLE ReadingRecord ADD COLUMN annotationStyle TEXT;");
}
if (!readingRecordColumns.some((column) => column.name === "color")) {
  db.exec("ALTER TABLE ReadingRecord ADD COLUMN color TEXT;");
}
if (!readingRecordColumns.some((column) => column.name === "rects")) {
  db.exec("ALTER TABLE ReadingRecord ADD COLUMN rects TEXT;");
}
db.exec("CREATE INDEX IF NOT EXISTS ReadingRecord_bookId_pageNumber_idx ON ReadingRecord(bookId, pageNumber);");
db.exec("CREATE INDEX IF NOT EXISTS ReadingRecord_parentRecordId_idx ON ReadingRecord(parentRecordId);");

db.close();

console.log(`Development database initialized at ${dbPath}`);
