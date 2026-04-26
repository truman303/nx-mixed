import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Forecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary: string | null;
}

@Component({
  selector: 'app-weather-forecast',
  imports: [CommonModule],
  template: `
    <section class="weather">
      <header>
        <h2>Weather forecast</h2>
        <small>
          Source: <code>GET /api/weatherforecast</code> →
          <code>demo-dotnet-api</code>
        </small>
      </header>

      @if (loading()) {
        <p class="status">Loading…</p>
      } @else if (error()) {
        <p class="status error">
          Failed to reach the API: {{ error() }}.<br />
          Make sure <code>demo-dotnet-api</code> is running
          (<code>nx run demo-dotnet-api:watch</code>) on
          <code>http://localhost:5039</code>.
        </p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>°C</th>
              <th>°F</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            @for (f of forecasts(); track f.date) {
              <tr>
                <td>{{ f.date }}</td>
                <td>{{ f.temperatureC }}</td>
                <td>{{ f.temperatureF }}</td>
                <td>{{ f.summary }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [
    `
      .weather {
        font-family:
          ui-sans-serif,
          system-ui,
          -apple-system,
          sans-serif;
        max-width: 640px;
        margin: 2rem auto;
        padding: 1.25rem 1.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      header {
        margin-bottom: 1rem;
      }
      h2 {
        margin: 0 0 0.25rem;
        font-size: 1.1rem;
      }
      small {
        color: #6b7280;
      }
      code {
        background: #f3f4f6;
        padding: 0 0.25rem;
        border-radius: 4px;
        font-size: 0.85em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }
      th,
      td {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #f1f5f9;
      }
      th {
        font-weight: 600;
        color: #374151;
        background: #f9fafb;
      }
      .status {
        margin: 0;
        color: #6b7280;
      }
      .status.error {
        color: #b91c1c;
      }
    `,
  ],
})
export class WeatherForecast implements OnInit {
  private http = inject(HttpClient);

  protected readonly forecasts = signal<Forecast[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<Forecast[]>('/api/weatherforecast').subscribe({
      next: (data) => {
        this.forecasts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Unknown error');
        this.loading.set(false);
      },
    });
  }
}
