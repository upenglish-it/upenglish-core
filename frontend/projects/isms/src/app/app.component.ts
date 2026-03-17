import { Component, OnInit, inject } from "@angular/core";
import { LocalStorageKeys } from "@isms-core/constants";
import { AccountStore, AssignedBranchesStore, BranchesStore, SelectedBranchStore } from "@isms-core/ngrx";
import { LocalStorageService, SSOService } from "@isms-core/services";
import { SeoService } from "@isms-core/services/src/seo";
import { ThemeService } from "@isms-core/services/src/theme";
import { TranslocoService } from "@jsverse/transloco";
import { lastValueFrom } from "rxjs";

@Component({
  selector: "isms-root",
  templateUrl: "./app.component.html",
  standalone: false,
})
export class AppComponent implements OnInit {
  private translocoService = inject(TranslocoService);
  public showRouter: boolean = false;

  constructor(
    private seoService: SeoService,
    private themeService: ThemeService,
    private readonly accountStore: AccountStore,
    private readonly selectedBranchStore: SelectedBranchStore,
    private readonly assignedBranchesStore: AssignedBranchesStore,
    private readonly branchesStore: BranchesStore,
    private readonly localStorageService: LocalStorageService,
    private readonly ssoService: SSOService
  ) {}
  public ngOnInit(): void {
    // const token =
    //   "hJDJ40EBlRNX4Y4begUC4KZBq64htCINoeBZ2xjrIg54qLYeKmLA6fkvOI6luN0Q4oGrFTVkkFS7NTnK7lAuwW7ZVD3ya/0obUYZwl4ES0EbZAIzS+u4xGDU4WVogIZw0xHq8EtrKv+HgSfTni+weNo9nnYW8MA+aFoJMXN9Sqx+rcIO25qEekEBptNn2ZNfz06D5WwbDzJHg7JNZKZYlt+HUB+oiCxLi7nIZ8nXzOIHNFJCmXTNPcDL9rEvCXkNNUF8Jhmxa8jIcDkx4bKimIMTOU+kw96djJGfuZCahgwy619VxtNcQQOTGFdvccwWGhOOk6bsa9eKfntPJLcfGMH1T8kQu6qRDBfGCBDOURL4Ea2vf4J0Ifby34wXLuMq1FKZXeNx2YnFf4ZqfxsNJupPZh5I0tObUU148kEWlbifFFlBTmp5CtTGnVJNHXlcyXXobgaO2DldCPqHw30ikD2xjV2vUUuewGpe12fDUTi9ANOrRjkoLei9wbD9KVPnbem2FJ/5jT9Bm9uTYMjBmYcLW1JxrAryOapJVd77MpeS4S0MKKdhNwHe82//cu8iCPCJwlE2HZym0gh9Xhlaz4q8iZ9jl5wTZfJs6GzB8gIX5U1tnIoCqaGb7/4ej21c87RERaD2cV+ehiqrPcCRkpdGoZTzCmcSkeC4JOS541We4HROlMKZ96g9e/+FveYgH9xpwKys+N4pDJNqDVPWKocVoduHvkgudTOatQmoZmgTbok4pYX68zGMY+FbxH32E4IvsHHdwKwSrVl+cf4jJ7ia3EUal5w/woITP429V4MXREdH+UfONW331mAYbNBdYqt36G20cQ/rSQP4NR44pliUK2u6l+8CivF8TrDn74dQZ9VspsX/TF3/WHnLVqDkRRfQl+UbDtgd905gM/HLsgpbhR5NaG0wpgfH7+YoRFYfkTm2/18kMJP43IiJUVj5sU/NdVEOWpcusfboazYjCWp+eiWDezzPVllFVCdgC2KIapqCtd15jJs040xqUwOjdjtHjEmQU1iYVwNwjKduFDfBD+gyuPQ+IIoEZF5Iy1Cark+54+47PzBJZ/vomq+DhMmVLJEurBHCcVg4Q8Mnx7jnalzEYyJM4yAUW3aBT/wDZIv25jhCWIwl4giRq2nav1HrHnPpn8EIQD5kV2PIpKXkkeiEneSJ/mtHgPFoDVpVRpAR5mpXjBYqOSwnkmNYAfmf+xpzQ8fBpqo1c3T2tBPF45Z4GzkUimpT9iO3umgVCobHZtO0gikerMsx+Jv9Nz+k4RhlfJwqrQdzjndru6rl40nhaUeVjf6oiiW0JWOvang+yZzs1caHUdNJipHwRuGWX7z+M/V2td10lEFjqjv2SRh1MLeA+D+N9ZE94f6slreXJiFSdEKF13WADUyxLr8mWBmBhRUg8s4DatRgPD3FHJwWKKxwvDuEqyd4UpO33F+f4A0kH6/atpt6a4IFYZ9Zv5jQG1hBMHflGF7BQsCNQ6xPIYXy1OZyBTLoNWDXEdB7zs0lv141nuEZiWMHc7EiVXUcXsS+3wejU898+giQlIQh90mY9hNvxcZJb8HyS87bzHl7byLNf50ggBWDSkBTWGb+TPUlEpu8N+I5OmW0X9JDxzIj35mIA0IOquBlCRJtKshLpOcO0fE+CH5iHANCsrorUBi/ZhWkdmGAyFGkwN3p9So81GlhwYaKtsLE1yVoVxCvY9+rT9R4AZIqTeQe6pkjJAbAUHMTZI5bFcqCFSSHqgs8nflbYRwXAtR56midoPoj+hhJZ8ESpYMC";
    // this.localStorageService.set(LocalStorageKeys.AUTHORIZATION, token);

    this.loadRequiredData();
    this.runGlobalServices();
  }

  private runGlobalServices(): void {
    this.seoService.init();
    this.themeService.init();
    this.translocoService.load("en");
  }

  private async loadRequiredData(): Promise<void> {
    lastValueFrom(this.ssoService.account()).then((res) => {
      if (res.success) {
        this.selectedBranchStore.update(res.data.selectedBranch);
        this.accountStore.update(res.data.account);
        this.showRouter = true;
        this.assignedBranchesStore.load();
        this.branchesStore.load();
      }
    });
  }
}
