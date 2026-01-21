import { http, HttpResponse } from "msw";
import { TaskEntity, toDateString, toTaskRes } from "../../shared/task";

let taskStore: TaskEntity[] = [];
let nextId = 1;

export const resetTaskStore = () => {
  taskStore = [];
  nextId = 1;
};

export const seedTaskStore = (tasks: TaskEntity[]) => {
  taskStore = [...tasks];
  const maxId = taskStore.reduce((max, task) => Math.max(max, task.id), 0);
  nextId = maxId + 1;
};

const findTaskOrNull = (taskId: number) =>
  taskStore.find((task) => task.id === taskId) ?? null;

export const taskHandlers = [
  http.get("*/api/tasks", ({ request }) => {
    const url = new URL(request.url);
    const today = toDateString(new Date());
    const targetDate = url.searchParams.get("date") ?? today;
    const isToday = targetDate === today;

    const tasks = taskStore.filter((task) => {
      const createdDate = toDateString(new Date(task.createdDate));
      if (createdDate !== targetDate) return false;

      if (!isToday) return true;
      if (!task.completedDate) return true;

      const completedDate = toDateString(new Date(task.completedDate));
      return completedDate === today;
    });

    return HttpResponse.json({
      tasks: tasks.map((task) => toTaskRes(task)),
    });
  }),

  http.post("*/api/tasks", async ({ request }) => {
    const body = (await request.json()) as { description?: string };
    const description = body.description ?? "";

    const newTask: TaskEntity = {
      id: nextId,
      description,
      totalFocusSeconds: 0,
      completedDate: null,
      createdDate: new Date(),
    } as TaskEntity;

    nextId += 1;
    taskStore.push(newTask);

    return HttpResponse.json(toTaskRes(newTask));
  }),

  http.patch("*/api/tasks/completion/:taskId", ({ params }) => {
    const taskId = Number(params.taskId);
    const task = findTaskOrNull(taskId);

    if (!task) {
      return HttpResponse.json({ message: "Task not found" }, { status: 404 });
    }

    task.completedDate = new Date();
    return HttpResponse.json(toTaskRes(task));
  }),

  http.patch("*/api/tasks/uncompletion/:taskId", ({ params }) => {
    const taskId = Number(params.taskId);
    const task = findTaskOrNull(taskId);

    if (!task) {
      return HttpResponse.json({ message: "Task not found" }, { status: 404 });
    }

    task.completedDate = null;
    return HttpResponse.json(toTaskRes(task));
  }),

  http.patch("*/api/tasks/:taskId", async ({ params, request }) => {
    const taskId = Number(params.taskId);
    const task = findTaskOrNull(taskId);

    if (!task) {
      return HttpResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const body = (await request.json()) as { description?: string };
    task.description = body.description ?? task.description;
    return HttpResponse.json(toTaskRes(task));
  }),

  http.delete("*/api/tasks/:taskId", ({ params }) => {
    const taskId = Number(params.taskId);
    const task = findTaskOrNull(taskId);

    if (!task) {
      return HttpResponse.json({ message: "Task not found" }, { status: 404 });
    }

    taskStore = taskStore.filter((existing) => existing.id !== taskId);
    return HttpResponse.json({});
  }),
];
