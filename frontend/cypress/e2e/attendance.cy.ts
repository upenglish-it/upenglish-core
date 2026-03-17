/* eslint-disable cypress/unsafe-to-chain-command */
/// <reference types="cypress" />
import { each, recurse } from "cypress-recurse";
import "cypress-real-events";

// let totalOfClass = 129;
// let totalOfMonths = 12;
// let totalOfYears = 3;

const startClass = 1; // #28 IC010
let totalOfClass = 129;

let totalOfMonths = 12;

const startYear = 1;
let totalOfYears = 4;

describe("Go to Login Page for Attendance", () => {
  beforeEach(() => {
    cy.visit("https://portal.upenglishvietnam.com/login");
  });

  it("should display the login form", () => {
    cy.get('input[name="Input.Email"]').should("be.visible");
    cy.get('input[name="Input.Password"]').should("be.visible");
    cy.get('button[type="submit"]').should("be.visible");
  });

  it("should login successfully with valid credentials", async () => {
    cy.get('input[name="Input.Email"]').type("huynhquan.nguyen@gmail.com", { delay: 50 });
    cy.get('input[name="Input.Password"]').type("1>vSr:$308}r", { delay: 50, log: false }); // hide password in logs
    cy.get(".login100-form-btn").click();

    // Wait for redirect
    cy.url().should("include", "/Home/Index");

    // Go to roll call page
    cy.get(":nth-child(8) > a").should("be.visible").click({ multiple: true });

    // Click the class dropdown
    cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div").should("be.visible").click({ multiple: true });

    // Class Value
    recurse(
      () => cy.get(".menuable__content__active").scrollTo("bottom"),
      ($list) => {
        // Check if we can find an element with specific text or attribute
        const targetElement = $list.find(".v-select-list > .v-list > div:nth-child(129) > a"); // max
        // console.log("targetElement", $list, targetElement.length, targetElement.is(":visible"));
        return targetElement.length > 0 && targetElement.is(":visible");
      },
      {
        limit: 50,
        delay: 500,
        log: true,
        timeout: 5000,
        // Custom error message
        error: "Could not find the 28th child element after scrolling",
      }
    ).then(($list) => {
      // Success callback - element found

      const totalElements = $list.find(".v-select-list > .v-list").children().length; // max

      console.log("Found the 28th child element:", totalElements);

      cy.get(".menuable__content__active > .v-select-list > .v-list > :nth-child(1)").click();

      // loadDataForClassMonthYear(1, 1, 1);

      // //load the #28 IC010
      LoadAttendance(122, 11, 1);
      // LoadAttendance(16, 9, 2);
      // LoadAttendance(2, 12, 2);
      // LoadAttendance(startClass, 1, startYear);
      // LoadAttendance(23, 1, 1);
      // LoadAttendance(1, 10, startYear);
    });
  });
});

const allData: { className: string; datas: any[] }[] = [];

const LoadAttendance = (classIndex: number, monthIndex: number, yearIndex: number) => {
  console.log(`Loading Class ${classIndex}, Month ${monthIndex}, Year ${yearIndex}`);

  // Class
  cy.get(".v-card__title > .layout > :nth-child(1) > .v-input > .v-input__control > .v-input__slot > .v-select__slot").click({
    multiple: true,
  });

  let classValue = "";
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${classIndex}) > .v-list__tile`).then(($class) => {
    classValue = $class.text().trim() || "";
  });

  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${classIndex})`).click({ multiple: true });

  cy.wait(200 as number);

  // Month
  cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(2) > div").should("exist").click({ multiple: true });
  // Month Value
  let monthValue = 0;
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${monthIndex}) > .v-list__tile`).then(($month) => {
    monthValue = parseInt($month.text().trim()) || 0;
  });
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${monthIndex}) > .v-list__tile`).should("exist").click({ multiple: true });
  cy.wait(200 as number);

  // // Year
  cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(3) > div").should("exist").click({ multiple: true });
  // Year Value
  let yearValue = 0;
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${yearIndex}) > .v-list__tile`).then(($year) => {
    yearValue = parseInt($year.text().trim()) || 0;
  });
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${yearIndex}) > .v-list__tile`).should("exist").click({ multiple: true });

  // Wait for the table to load
  cy.wait(2000);
  cy.get("body").then(($body) => {
    // cy.get(".v-card__title > :nth-child(1) > :nth-child(7) > :nth-child(1)", { timeout: 2000 });

    if ($body.find(".v-card__title > :nth-child(1) > :nth-child(7) > :nth-child(1)").length) {
      // console.log("Element found — test continues");

      const cells: any = [];
      const headers: string[] = [];

      cy.get(".table > thead > tr")
        .should("be.visible")
        .each(($row, rowIndex) => {
          // Loop all the th
          cy.wrap($row)
            .should("be.visible")
            .children()
            .each(($cell, cellIndex) => {
              headers.push(($cell[0] as HTMLElement).textContent?.trim() || "");
            });
        });

      cy.get(".table > tbody > tr")
        .should("be.visible")
        .each(($row, rowIndex) => {
          // console.log(">>>", $row.length, rowIndex);
          const localCells: {
            stt: string;
            studentName: string;
            attendance: { status: "present" | "absent" | "off-day" | ""; day: number }[];
            totalAttendanceInAMonth: number;
            // classValue: string;
            // monthValue: number;
            // yearValue: number;
          } = {
            stt: "",
            studentName: "",
            attendance: [],
            totalAttendanceInAMonth: 0,
          };

          // Loop all the td
          cy.wrap($row)
            .should("be.visible")
            .children()
            .each(($cell, cellIndex) => {
              // console.log(">>>", ($cell[0] as HTMLElement).textContent?.trim() || "", $cell.length);
              if (cellIndex === 0) {
                localCells.stt = ($cell[0] as HTMLElement).textContent?.trim() || "";
              } else if (cellIndex === 1) {
                localCells.studentName = ($cell[0] as HTMLElement).textContent?.trim() || "";
              } else {
                let status = "";

                // Check if OFF
                const value = ($cell[0] as HTMLElement).textContent?.trim() || "";
                if (value === "OFF") {
                  status = "off-day";
                }

                // Check if Present
                if ($cell.find('input[aria-checked="true"]').length > 0) {
                  status = "present";
                }

                // Check if Absent
                if ($cell.find('input[aria-checked="false"]').length > 0) {
                  status = "absent";
                }

                localCells.attendance.push({
                  status: status as any,
                  day: parseInt(headers[cellIndex]),
                });
              }
            })
            .then(() => {
              localCells.totalAttendanceInAMonth = localCells.attendance.length;
              cells.push(localCells);
              console.log("localCells", localCells);
            });
        })
        .then(() => {
          console.log("done all cells", cells);
          allData.push({ className: `Class ${classIndex}`, datas: cells });
          cy.request({
            method: "POST",
            url: "http://localhost:3000/api/v1/migrations/attendance", // full URL or relative to baseUrl
            body: {
              data: {
                classIndex: classIndex,
                monthIndex: monthIndex,
                yearIndex: yearIndex,

                classValue: classValue,
                monthValue: monthValue,
                yearValue: yearValue,

                data: cells,
              },
            },
            headers: {
              "Content-Type": "application/json",
            },
          }).then((response) => {
            // console.log("Response:", JSON.stringify(response.body));

            // when done, call the next
            LoadNext(classIndex, monthIndex, yearIndex);
          });
        });
    } else {
      console.log("Element not found — skipping click");
      LoadNext(classIndex, monthIndex, yearIndex);
    }

    // console.log("allData", allData);
  });
};

const LoadNext = (classIndex: number, monthIndex: number, yearIndex: number) => {
  if (yearIndex < totalOfYears) {
    console.log("▶ load again for year", classIndex, monthIndex, yearIndex + 1);
    LoadAttendance(classIndex, monthIndex, yearIndex + 1);
  } else if (monthIndex < totalOfMonths) {
    console.log("▶ load again for month", classIndex, monthIndex + 1, startYear);
    LoadAttendance(classIndex, monthIndex + 1, startYear);
  } else if (classIndex < totalOfClass) {
    console.log("▶ load again for class", classIndex + 1, 1, startYear);
    LoadAttendance(classIndex + 1, 1, startYear);
  } else {
    console.log("🎉 Finished all classes, months, and years", classIndex, monthIndex, yearIndex);
  }
};
