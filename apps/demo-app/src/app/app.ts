import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';
import { WeatherForecast } from './weather-forecast';

@Component({
  imports: [NxWelcome, RouterModule, WeatherForecast],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'demo-app';
}
