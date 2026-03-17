import { DecimalPipe, NgStyle } from "@angular/common";
import { Component, Input } from "@angular/core";
import { TestsOfClassPeriodsSectionsI } from "@superlms/interfaces/index";
import { TestI } from "projects/superlms/src/app/pages/task/pages/builder/form-group/test.form-group";

@Component({
  selector: "slms-timeline-test-result",
  imports: [NgStyle, DecimalPipe],
  templateUrl: "./timeline-test-result.component.html",
  styleUrl: "./timeline-test-result.component.less",
})
export class TimelineTestResultComponent {
  @Input({ alias: "tests", required: true }) public tests: TestI[];
  @Input({ alias: "periods-section", required: true }) public periodsSection: TestsOfClassPeriodsSectionsI;

  // public get overallRating() {}

  // public get readingScore() {}

  // public get writingScore() {}

  // public get speakingScore() {}

  // public get listeningScore() {}

  // const reading= this.tests.find((test: TestI) => test.type === "reading");
  // if (!reading?.variations) return { overAllTotal: 0, totalPoints: 0, percentage: 0 };

  // reading.variations.forEach((variation: any) => {
  //   variation.parts?.forEach((part: any) => {
  //     part.items?.forEach((item: any) => {
  //       overAllTotal += Number(item.score ?? 0);
  //       totalPoints += Number(item.points ?? 0);
  //     });
  //   });
  // });

  // const percentage = totalPoints > 0 ? (overAllTotal / totalPoints) * 100 : 0;

  // return {
  //   overAllTotal,
  //   totalPoints,
  //   percentage: Number(percentage.toFixed(2)),
  // };
  // }

  /** Extract all items for a specific skill (reading, writing, speaking, listening) */
  private getItemsByType(type: string) {
    return this.tests.filter((t) => t.type === type).flatMap((t) => t.variations.flatMap((v) => v.parts.flatMap((p) => p.items)));
  }

  /** Computes total score, total points, and rating % */
  private computeScore(type: string) {
    const items = this.getItemsByType(type);

    const totalScore = items.reduce((s, i) => s + (i.score ?? 0), 0);
    const totalPoints = items.reduce((s, i) => s + (i.points ?? 0), 0);

    return {
      totalScore,
      totalPoints,
      rating: totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0,
    };
  }

  // ------------------------------
  //         PUBLIC GETTERS
  // ------------------------------

  public get readingScore() {
    return this.computeScore("reading").rating;
  }

  public get writingScore() {
    return this.computeScore("writing").rating;
  }

  public get speakingScore() {
    return this.computeScore("speaking").rating;
  }

  public get listeningScore() {
    return this.computeScore("listening").rating;
  }

  /** Overall rating = average of existing skill ratings */
  public get overallRating() {
    const ratings = [this.readingScore, this.writingScore, this.speakingScore, this.listeningScore].filter((r) => r > 0);

    if (ratings.length === 0) return 0;

    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }

  /** Total Duration (sum of all test.duration) */
  public get totalDuration() {
    return this.tests.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  }

  public get reviewerAnswers() {
    return this.tests.flatMap((test) =>
      test.variations
        .filter((variation) => variation.reviewerAnswer && variation.reviewerAnswer.trim() !== "")
        .map((variation) => ({
          name: test.name,
          reviewerAnswer: variation.reviewerAnswer,
        }))
    );
  }
}
