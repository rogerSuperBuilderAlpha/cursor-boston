import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { initialProject } from "./project";
import type { Task, TaskPriority, TaskStatus } from "./types";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  github_issue_number: number | null;
};

declare global {
  var __taskDatabase: Database.Database | undefined;
}

function getDatabasePath(): string {
  const dataDirectory = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDirectory, { recursive: true });
  return path.join(dataDirectory, "tasks.db");
}

function seedDatabase(database: Database.Database): void {
  const insert = database.prepare(`
    INSERT INTO tasks (id, title, status, priority, github_issue_number)
    VALUES (@id, @title, @status, @priority, @githubIssueNumber)
  `);

  const seedMany = database.transaction((tasks: Task[]) => {
    for (const task of tasks) {
      insert.run({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        githubIssueNumber: task.githubIssueNumber ?? Number.parseInt(task.id, 10),
      });
    }
  });

  seedMany(initialProject.tasks);
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('backlog', 'in-progress', 'review', 'done')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
      github_issue_number INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const countRow = database.prepare("SELECT COUNT(*) AS count FROM tasks").get() as {
    count: number;
  };

  if (countRow.count === 0) {
    seedDatabase(database);
  }
}

export function getDatabase(): Database.Database {
  if (!globalThis.__taskDatabase) {
    const database = new Database(getDatabasePath());
    database.pragma("journal_mode = WAL");
    initializeSchema(database);
    globalThis.__taskDatabase = database;
  }

  return globalThis.__taskDatabase;
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    githubIssueNumber: row.github_issue_number,
  };
}

export function listTasks(): Task[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `
      SELECT id, title, status, priority, github_issue_number
      FROM tasks
      ORDER BY CAST(id AS INTEGER) ASC, id ASC
    `,
    )
    .all() as TaskRow[];

  return rows.map(mapRow);
}

export function getTaskById(taskId: string): Task | null {
  const database = getDatabase();
  const row = database
    .prepare(
      `
      SELECT id, title, status, priority, github_issue_number
      FROM tasks
      WHERE id = ?
    `,
    )
    .get(taskId) as TaskRow | undefined;

  return row ? mapRow(row) : null;
}

export function getTaskByGitHubIssue(issueNumber: number): Task | null {
  const database = getDatabase();
  const row = database
    .prepare(
      `
      SELECT id, title, status, priority, github_issue_number
      FROM tasks
      WHERE github_issue_number = ? OR id = ?
      LIMIT 1
    `,
    )
    .get(issueNumber, String(issueNumber)) as TaskRow | undefined;

  return row ? mapRow(row) : null;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): Task | null {
  const database = getDatabase();
  const result = database
    .prepare(
      `
      UPDATE tasks
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    )
    .run(status, taskId);

  if (result.changes === 0) {
    return null;
  }

  return getTaskById(taskId);
}

export function markTaskDoneByGitHubIssue(issueNumber: number): Task | null {
  const task = getTaskByGitHubIssue(issueNumber);
  if (!task) {
    return null;
  }

  if (task.status === "done") {
    return task;
  }

  return updateTaskStatus(task.id, "done");
}
