import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedUi } from '@nx-mixed/shared-ui';
import { NxWelcome } from './nx-welcome';
import { WeatherForecast } from './weather-forecast';

@Component({
  imports: [NxWelcome, RouterModule, WeatherForecast, SharedUi],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'demo-app';
}
