import { animate, style, transition, trigger } from "@angular/animations";

export const Animations = {
  default: trigger("default", [
    transition(":enter", [style({ opacity: 0 }), animate("150ms ease-out", style({ opacity: 1 }))]),
    transition(":leave", [style({ opacity: 1 }), animate("100ms ease-in", style({ opacity: 0 }))]),
  ]),
  down: trigger("down", [
    transition(":enter", [style({ opacity: 0, transform: "translateY(-2%)" }), animate("150ms ease-out", style({ opacity: 1, transform: "translateY(0%)" }))]),
    transition(":leave", [style({ opacity: 1, transform: "translateY(0%)" }), animate("100ms ease-in", style({ opacity: 0, transform: "translateY(-2%)" }))]),
  ]),
};
