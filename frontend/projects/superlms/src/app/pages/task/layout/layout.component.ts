/**
 * Layout Component
 *
 * @file          layout.component
 * @description   Content wrapper and renders the page for dynamic content.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

import { RouterOutlet } from "@angular/router";
import { Component, ViewEncapsulation } from "@angular/core";

@Component({
  selector: "layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  encapsulation: ViewEncapsulation.None,
  imports: [
    //--- NG Modules
    RouterOutlet,
  ],
})
export class LayoutComponent {}
