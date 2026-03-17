import Quill from "quill";
import { TestFormGroup } from "./form-group/test.form-group";

export class DataComponent {
  //--- Public
  public quill: Quill;

  public readonly testFormGroup = TestFormGroup();
}
