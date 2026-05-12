// ------------------------------------------------------------------------------------------
//  SIDEBAR-CARD (Customized & Stabilized with Visual Editor)
// ------------------------------------------------------------------------------------------

const SIDEBAR_CARD_TITLE = 'ADVANCED-SIDEBAR-CARD';
const SIDEBAR_CARD_VERSION = '0.3.0';

import { css, html, LitElement } from 'lit-element';
import { moreInfo } from 'card-tools/src/more-info';
import { hass, provideHass } from 'card-tools/src/hass';
import { subscribeRenderTemplate } from 'card-tools/src/templates';
import moment from 'moment/min/moment-with-locales';
import { forwardHaptic, navigate, toggleEntity } from 'custom-card-helpers';

// ##########################################################################################
// ###   Default Configuration
// ##########################################################################################

const DEFAULT_CONFIG = {
  showTopMenuOnMobile: false,
  digitalClock: true,
  width: { mobile: 0, tablet: 18, desktop: 18 },
  breakpoints: { mobile: 768, tablet: 1024 },
  date: true,
  dateFormat: 'dddd, D. MMMM YYYY',
  // clockAction: { action: 'navigate', navigation_path: '/dashboard-home' }, // optional: make clock clickable
  // dateAction: { action: 'navigate', navigation_path: '/dashboard-home' },  // optional: make date clickable
  template: '',
  updateMenu: true,
  sidebarMenu: [
    { action: 'navigate', navigation_path: '/dashboard-home/home', name: 'Übersicht', active: true, icon: 'mdi:home' },
    { action: 'navigate', navigation_path: '/dashboard-home/eg', name: 'EG', icon: 'mdi:image-area', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/og', name: 'OG', icon: 'mdi:image-area', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/ausen', name: 'Außen', icon: 'mdi:image-area', active: true },
    { action: 'none', name: 'null', icon: 'null', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/staubsauger', name: 'Staubsauger', icon: 'mdi:robot-vacuum', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/multimedia', name: 'Multimedia', icon: 'mdi:play-circle-outline', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/sprechanlage', name: 'Sprechanlage', icon: 'mdi:doorbell-video', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/kameras', name: 'Kameras', icon: 'mdi:cctv', active: true },
    { action: 'navigate', navigation_path: '/dashboard-home/technik', name: 'Technik', icon: 'mdi:cogs', active: true }
  ],
  bottomCard: {
    type: 'custom:vertical-stack-in-card',
    cardOptions: {
      cards: [
        {
          type: 'custom:trash-card',
          entities: ['calendar.abfalltermine'],
          event_grouping: true,
          drop_todayevents_from: '10:00:00',
          next_days: 7,
          pattern: [
            { icon: '', color: 'rgba(250, 250, 250, 1)', type: 'organic', pattern: 'Bio', picture: '/local/abfall/bio.svg' },
            { icon: '', color: 'rgba(250, 250, 250, 1)', type: 'paper', pattern: 'Papier', picture: '/local/abfall/papier.svg' },
            { icon: '', color: 'rgba(250, 250, 250, 1)', type: 'recycle', label: 'Gelber Sack', pattern: 'Gelb', picture: '/local/abfall/gelb.svg' },
            { icon: '', color: 'rgba(250, 250, 250, 1)', type: 'waste', pattern: 'Rest', picture: '/local/abfall/rest.svg' },
            { icon: '', color: 'rgba(250, 250, 250, 1)', type: 'others' },
            { label: 'Windelsack', icon: '', color: 'rgba(250, 250, 250, 1)', type: 'custom', picture: '/local/abfall/windel.svg', pattern: 'Windel' },
            { label: 'Problemmüll', icon: '', color: 'rgba(250, 250, 250, 1)', type: 'custom', pattern: 'Problem', picture: '/local/abfall/problem.svg' },
            { label: 'Sperrmüll', icon: '', color: 'rgba(250, 250, 250, 1)', type: 'custom', pattern: 'Sperr', picture: '/local/abfall/sperr.svg' }
          ],
          day_style: 'counter', card_style: 'chip', alignment_style: 'center', color_mode: 'background', items_per_row: 1, refresh_rate: 60, with_label: true, filter_events: true, hide_time_range: false, use_summary: false, full_size: false, only_all_day_events: false
        },
        {
          type: 'horizontal-stack',
          cards: [
            {
              type: 'custom:mushroom-person-card', entity: 'person.anselm_friedrich', fill_container: false, icon_type: 'entity-picture', primary_info: 'name', secondary_info: 'state',
              card_mod: { style: 'ha-card { background-color: rgba(250, 250, 250, 1) !important; border-width: 0px !important; border-radius: 20px !important; margin-bottom: 10px !important; margin-top: 20px !important; margin-right: 3px !important; margin-left: 3px !important; }' }
            },
            {
              type: 'custom:mushroom-person-card', entity: 'person.julia_friedrich', icon_type: 'entity-picture', primary_info: 'name', secondary_info: 'state',
              card_mod: { style: 'ha-card { background-color: rgba(250, 250, 250, 1) !important; border-width: 0px !important; border-radius: 20px !important; margin-bottom: 10px !important; margin-top: 20px !important; margin-right: 3px !important; margin-left: 3px !important; }' }
            }
          ]
        },
        {
          type: 'custom:clock-weather-card', entity: 'weather.zuhause', forecast_rows: 5, hide_clock: true, hide_date: true,
          card_mod: { style: 'ha-card { background-color: rgba(250, 250, 250, 1) !important; border-width: 0px !important; border-radius: 20px !important; margin-bottom: 10px !important; }' }
        }
      ]
    }
  },
  cardStyle: `
    :host { width: 99%; }
    ha-card { border: none !important; box-shadow: none !important; background-color: rgba(250, 250, 250, 1) !important; }
  `,
  style: `
    :host { --sidebar-background: #fafafa; --sidebar-text-color: var(--google-blue); }
    #customSidebar { z-index: 9999 !important; }
    .sidebarMenu li { line-height: 20px !important; color: var(--primary-text-color)!important; }
    .sidebarMenu li.active { border-radius: 20px !important; color: #6a889e !important; font-weight: 400 !important; }
    .sidebarMenu li.active ha-icon { color: #6a889e !important; }
    .bottom { width: 100% !important; }  
    .digitalClock { padding-bottom: 5px; padding-top: 15px; color: var(--primary-text-color) !important; opacity: 0.6; font-size: 60px !important; font-weight: 400 !important; letter-spacing: -0.05vw !important; text-align: center; }
    .date { padding-bottom: 10px; padding-top: 10px; color: var(--primary-text-color); opacity: 0.6; font-size: 25px; font-weight: 300; text-align: center; letter-spacing: -0.05vw; }
    .template li { color: var(--primary-text-color) !important; font-size: 1.1vw !important; font-weight: 200 !important; opacity: 0.6; letter-spacing: -0.05vw !important; text-align: center; margin-bottom: 10px !important; }
  `
};

// ##########################################################################################
// ###   Editor Element
// ##########################################################################################

const fireEvent = (node: any, type: string, detail: any, options?: any) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable: Boolean(options.cancelable),
    composed: options.composed === undefined ? true : options.composed,
  });
  (event as any).detail = detail;
  node.dispatchEvent(event);
  return event;
};

class SidebarCardEditor extends LitElement {
  _config: any;

  setConfig(config) {
    this._config = config;
  }

  get _digitalClock() { return this._config?.digitalClock ?? true; }
  get _date() { return this._config?.date ?? true; }
  get _dateFormat() { return this._config?.dateFormat ?? 'dddd, D. MMMM YYYY'; }
  get _updateMenu() { return this._config?.updateMenu ?? true; }
  get _style() { return this._config?.style ?? ''; }
  get _cardStyle() { return this._config?.cardStyle ?? ''; }
  get _sidebarMenu() { return this._config?.sidebarMenu || []; }
  get _bottomCard() { return JSON.stringify(this._config?.bottomCard ?? {}, null, 2); }

  render() {
    if (!this._config) return html``;

    return html`
      <div class="card-config">
        <h3>Allgemeine Einstellungen</h3>
        <ha-formfield label="Digitale Uhr anzeigen">
          <ha-switch .checked=${this._digitalClock} .configValue=${'digitalClock'} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>
        <br/>
        <ha-formfield label="Datum anzeigen">
          <ha-switch .checked=${this._date} .configValue=${'date'} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>
        <br/>
        <ha-formfield label="Menü bei Navigation aktualisieren (Active-Status)">
          <ha-switch .checked=${this._updateMenu} .configValue=${'updateMenu'} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>
        <br/>
        <ha-textfield label="Datumsformat" .value=${this._dateFormat} .configValue=${'dateFormat'} @input=${this._valueChanged}></ha-textfield>

        <h3>Menüeinträge</h3>
        <div class="menu-items">
          ${this._sidebarMenu.map((item, index) => html`
            <div class="menu-item">
              <div class="menu-item-header">
                <span>Eintrag ${index + 1}: ${item.name || 'Unbenannt'}</span>
                <div class="menu-item-actions">
                  <button class="icon-btn" @click=${() => this._moveMenuItem(index, -1)} ?disabled=${index === 0}>▲</button>
                  <button class="icon-btn" @click=${() => this._moveMenuItem(index, 1)} ?disabled=${index === this._sidebarMenu.length - 1}>▼</button>
                  <button class="icon-btn delete-btn" @click=${() => this._removeMenuItem(index)}>✖</button>
                </div>
              </div>
              
              <div class="menu-item-grid">
                <ha-textfield label="Name" .value=${item.name || ''} .configValue=${'name'} @input=${(e) => this._menuItemChanged(index, e)}></ha-textfield>
                <ha-textfield label="Icon (z.B. mdi:home)" .value=${item.icon || ''} .configValue=${'icon'} @input=${(e) => this._menuItemChanged(index, e)}></ha-textfield>
                <ha-textfield label="Aktion (z.B. navigate, none)" .value=${item.action || 'navigate'} .configValue=${'action'} @input=${(e) => this._menuItemChanged(index, e)}></ha-textfield>
                <ha-textfield label="Pfad (navigation_path)" .value=${item.navigation_path || ''} .configValue=${'navigation_path'} @input=${(e) => this._menuItemChanged(index, e)}></ha-textfield>
              </div>

              <ha-formfield label="Aktiviert">
                <ha-switch .checked=${item.active !== false} .configValue=${'active'} @change=${(e) => this._menuItemChanged(index, e)}></ha-switch>
              </ha-formfield>
            </div>
          `)}
        </div>
        <button class="add-btn" @click=${this._addMenuItem}>+ Neuen Menüeintrag hinzufügen</button>

        <h3>Bottom Card (JSON Format)</h3>
        <p class="hint">Aufgrund der extremen Verschachtelung bleibt dieser Bereich als YAML/JSON für Copy & Paste erhalten.</p>
        <ha-textarea
          label="Bottom Card Objekt"
          .value=${this._bottomCard}
          .configValue=${'bottomCard'}
          @input=${this._jsonValueChanged}
          rows="10"
        ></ha-textarea>

        <h3>Styling (CSS)</h3>
        <ha-textarea label="Sidebar Global Style" .value=${this._style} .configValue=${'style'} @input=${this._valueChanged}></ha-textarea>
        <ha-textarea label="Bottom Card Base Style" .value=${this._cardStyle} .configValue=${'cardStyle'} @input=${this._valueChanged}></ha-textarea>
      </div>
    `;
  }

  _menuItemChanged(index, ev) {
    if (!this._config) return;
    const target = ev.target;
    let newValue = target.value;
    if (target.tagName.toLowerCase() === 'ha-switch') {
      newValue = target.checked;
    }

    const newMenu = [...this._sidebarMenu];
    newMenu[index] = { ...newMenu[index], [target.configValue]: newValue };
    
    fireEvent(this, 'config-changed', {
      config: { ...this._config, sidebarMenu: newMenu },
    });
  }

  _addMenuItem() {
    const newMenu = [...this._sidebarMenu, { name: 'Neuer Eintrag', action: 'navigate', navigation_path: '/dashboard/', icon: 'mdi:view-dashboard', active: true }];
    fireEvent(this, 'config-changed', {
      config: { ...this._config, sidebarMenu: newMenu },
    });
  }

  _removeMenuItem(index) {
    const newMenu = [...this._sidebarMenu];
    newMenu.splice(index, 1);
    fireEvent(this, 'config-changed', {
      config: { ...this._config, sidebarMenu: newMenu },
    });
  }

  _moveMenuItem(index, direction) {
    const newMenu = [...this._sidebarMenu];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newMenu.length) return;
    
    const temp = newMenu[index];
    newMenu[index] = newMenu[targetIndex];
    newMenu[targetIndex] = temp;

    fireEvent(this, 'config-changed', {
      config: { ...this._config, sidebarMenu: newMenu },
    });
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    if (this[`_${target.configValue}`] === target.value) return;
    
    let newValue = target.value;
    if (target.tagName.toLowerCase() === 'ha-switch') {
      newValue = target.checked;
    }

    fireEvent(this, 'config-changed', {
      config: { ...this._config, [target.configValue]: newValue },
    });
  }

  _jsonValueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    try {
      const parsed = JSON.parse(target.value);
      fireEvent(this, 'config-changed', {
        config: { ...this._config, [target.configValue]: parsed },
      });
    } catch (e) {
      // Parsing-Fehler beim Tippen ignor
