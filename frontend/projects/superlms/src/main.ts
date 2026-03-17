import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

import Quill from "quill";
import { StaticDragNDropBlot } from "./app/pages/task/pages/builder/quillblot/static-drag-n-drop.quillblot";
Quill.register("formats/static-drag-n-drop-blot", StaticDragNDropBlot);

import QuillBetterTable from "quill-better-table";
Quill.register({ "modules/better-table": QuillBetterTable });

import { MovableDragNDropTextboxBlot } from "./app/pages/task/pages/builder/quillblot/movable-drag-n-drop-textbox.quillblot";
Quill.register("formats/movable-drag-n-drop-blot", MovableDragNDropTextboxBlot);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
