import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const todoFile = new URL("../data/todos.json", import.meta.url);
const todoFilePath = fileURLToPath(todoFile);

export async function listTodos() {
  return readTodos();
}

export async function addTodo(text) {
  const todos = await readTodos();
  const todo = {
    id: nextId(todos),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.push(todo);
  await writeTodos(todos);
  return todo;
}

export async function completeTodo(id) {
  const todos = await readTodos();
  const todo = todos.find((item) => item.id === id);

  if (!todo) {
    return null;
  }

  todo.completed = true;
  todo.completedAt = new Date().toISOString();
  await writeTodos(todos);
  return todo;
}

export async function clearCompletedTodos() {
  const todos = await readTodos();
  const activeTodos = todos.filter((todo) => !todo.completed);
  const removed = todos.length - activeTodos.length;

  await writeTodos(activeTodos);
  return removed;
}

async function readTodos() {
  await ensureStore();
  const raw = await readFile(todoFilePath, "utf8");
  return JSON.parse(raw);
}

async function writeTodos(todos) {
  await ensureStore();
  await writeFile(todoFilePath, JSON.stringify(todos, null, 2), "utf8");
}

async function ensureStore() {
  await mkdir(dirname(todoFilePath), {
    recursive: true
  });

  try {
    await readFile(todoFilePath, "utf8");
  } catch {
    await writeFile(todoFilePath, "[]\n", "utf8");
  }
}

function nextId(todos) {
  return todos.reduce((maxId, todo) => Math.max(maxId, todo.id), 0) + 1;
}
