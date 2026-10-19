import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CloudOff,
  CloudRain,
  CloudSun,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  Wheat,
  X,
} from "lucide-react";
import {
  availableFor,
  assessTodayWeather,
  batchPrice,
  batchViews,
  businessClock,
  businessDateKey,
  dateKey,
  describeTomorrowWeather,
  expirationAdvice,
  forecast,
  hours,
  id,
  initialPlan,
  initialData,
  key,
  money,
  plural,
  saleLinesFor,
  salesFitBatches,
  shortDateTime,
  timeInput,
  todayRecommendation,
  weatherLabel,
  type Batch,
  type Data,
  type Product,
  type Sale,
  type Weather,
  type HourlyWeather,
  type TodayWeather,
} from "./model";
import { SalesHistoryChart } from "./AnalyticsCharts";
import "./index.css";

type Dialog = "product" | "batch" | "sale" | null;
type WeatherState = {
  items: Weather[];
  hourly: HourlyWeather[];
  timeZone?: string;
  status: "idle" | "loading" | "ready" | "error";
  message: string;
};
const ruToday = () =>
  new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};
const tomorrowLabel = () =>
  tomorrow().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
const fmt = (n: number) => `${n} ${plural(n, "шт.", "шт.", "шт.")}`;
const rub = (n: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n)} ₽`;
const remainingTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [
    h ? hours(h) : "",
    m ? `${m} ${plural(m, "минута", "минуты", "минут")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

function useData() {
  const [data, setData] = useState<Data>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialData;
      const parsed = JSON.parse(raw) as Data;
      return {
        ...initialData,
        ...parsed,
        settings: { ...initialData.settings, ...parsed.settings },
      };
    } catch {
      return initialData;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* storage full: keep current session */
    }
  }, [data]);
  return { data, setData };
}
function useWeather(city: string) {
  const [state, setState] = useState<WeatherState>({
    items: [],
    hourly: [],
    status: "idle",
    message: "",
  });
  useEffect(() => {
    if (!city.trim()) {
      setState({
        items: [],
        hourly: [],
        status: "idle",
        message: "Укажите город в настройках",
      });
      return;
    }
    const controller = new AbortController();
    setState({ items: [], hourly: [], status: "loading", message: "Загружаем прогноз погоды" });
    const load = async (initial = false) => {
      setState((previous) => !initial && previous.status === "ready" ? previous : {
        items: [], hourly: [], status: "loading",
        message: "Загружаем прогноз погоды",
      });
      try {
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`,
          { signal: controller.signal },
        );
        if (!geoResponse.ok) throw new Error("Город не найден");
        const geo = await geoResponse.json();
        const place = geo.results?.[0];
        if (!place) throw new Error("Город не найден");
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max&hourly=weather_code,temperature_2m&timezone=auto&forecast_days=3`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Погода временно недоступна");
        const result = await response.json();
        const items: Weather[] = result.daily.time.map(
          (date: string, i: number) => ({
            date,
            code: result.daily.weather_code[i],
            temperature: result.daily.temperature_2m_max[i],
            label: weatherLabel(result.daily.weather_code[i]),
          }),
        );
        const hourly: HourlyWeather[] = Array.isArray(result.hourly?.time)
          ? result.hourly.time.map((time: string, i: number) => ({
              time,
              code: result.hourly.weather_code?.[i],
              temperature: result.hourly.temperature_2m?.[i],
            }))
          : [];
        setState({ items, hourly, timeZone: result.timezone || place.timezone,
          status: "ready", message: `Погода: ${place.name}` });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            items: [],
            hourly: [],
            status: "error",
            message:
              error instanceof Error ? error.message : "Погода недоступна",
          });
      }
    };
    const timeout = setTimeout(() => load(true), 350);
    const refresh = setInterval(() => load(), 30 * 60 * 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(refresh);
      controller.abort();
    };
  }, [city]);
  return state;
}
function IconMark({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo-mark ${light ? "logo-mark-light" : ""}`}>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="brand">
      <IconMark light={light} />
      <span>
        economics<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
function PrimaryButton({
  children,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`primary-button ${className}`}
    >
      {children}
    </button>
  );
}
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading reveal">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
}

function Landing() {
  useReveal();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState({ x: -100, y: -100, active: false });
  const submitContact = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.elements.namedItem("contactName") as HTMLInputElement;
    const phone = form.elements.namedItem("contactPhone") as HTMLInputElement;

    if (!name.value.trim()) {
      name.setCustomValidity("Введите имя.");
      name.reportValidity();
      return;
    }

    const phoneValue = phone.value.trim();
    const digits = phoneValue.replace(/\D/g, "");
    if (
      !/^[+\d\s()-]+$/.test(phoneValue) ||
      digits.length < 10 ||
      digits.length > 15
    ) {
      phone.setCustomValidity("Введите корректный номер телефона.");
      phone.reportValidity();
      return;
    }

    form.reset();
  };
  const ribbonWords = [
    "ПОГОДА",
    "ПРОДАЖИ",
    "ДЕНЬ НЕДЕЛИ",
    "СРОК ГОДНОСТИ",
    "РЕШЕНИЕ",
  ];
  return (
    <div
      className="landing"
      onMouseMove={(e) =>
        setCursor({ x: e.clientX, y: e.clientY, active: true })
      }
      onMouseLeave={() => setCursor((c) => ({ ...c, active: false }))}
    >
      <div
        className={`cursor-ring ${cursor.active ? "on" : ""}`}
        style={{
          transform: `translate(${cursor.x - 16}px,${cursor.y - 16}px)`,
        }}
      />
      <header className="site-header">
        <div className="site-container header-inner">
          <Link to="/" aria-label="Economics, главная">
            <Brand />
          </Link>
          <nav>
            <a href="#problem">О продукте</a>
            <a href="#workflow">Как это работает</a>
            <a href="#capabilities">Возможности</a>
            <a href="#contact">Контакты</a>
          </nav>
          <div className="header-actions">
            <Link to="/app" className="header-login">
              Войти
            </Link>
            <Link to="/register" className="header-register">
              Регистрация <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="hero site-container">
          <div className="hero-copy reveal">
            <div className="pill">
              <span className="pulse-dot" /> Умное планирование выпечки
            </div>
            <h1>
              Меньше догадок.
              <br />
              <span>Больше точности.</span>
            </h1>
            <p className="hero-subtitle">
              Понимайте, сколько приготовить завтра и когда нужна дополнительная
              партия сегодня. Economics помогает опираться на продажи, погоду и
              календарь — вместо интуиции.
            </p>
            <div className="hero-actions">
              <PrimaryButton onClick={() => navigate("/app")}>
                Открыть приложение <ArrowUpRight size={18} />
              </PrimaryButton>
              <a href="#workflow" className="round-link">
                <span>
                  <ArrowDownRight size={19} />
                </span>{" "}
                Как это работает
              </a>
            </div>
          </div>
          <div className="hero-visual reveal">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="visual-shadow" />
            <div className="floating-chip chip-top">
              <Sun size={19} />
              <span>
                Завтра
                <br />
                <b>ясно, +22°</b>
              </span>
            </div>
            <div className="forecast-sculpture">
              <div className="sculpture-top">
                <span>Прогноз спроса</span>
                <span>↗ 12%</span>
              </div>
              <div className="sculpture-bars">
                {[36, 50, 42, 66, 54, 78, 62, 94].map((h, i) => (
                  <div key={i} className="sculpture-bar-wrap">
                    <div
                      className="sculpture-bar"
                      style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
                    />
                  </div>
                ))}
              </div>
              <div className="sculpture-bottom">
                <span>ПН</span>
                <span>ВТ</span>
                <span>СР</span>
                <span>ЧТ</span>
                <span>ПТ</span>
                <span>СБ</span>
                <span>ВС</span>
                <span>ЗАВТРА</span>
              </div>
            </div>
            <div className="floating-chip chip-bottom">
              <span className="chip-icon">
                <Wheat size={19} />
              </span>
              <span>
                План на завтра
                <br />
                <b>По данным ваших продаж</b>
              </span>
              <ArrowUpRight size={17} />
            </div>
            <span className="decor-star star-one">✳</span>
            <span className="decor-star star-two">✳</span>
            <span className="visual-caption">Пример визуализации</span>
          </div>
        </section>
        <div className="ticker" aria-label={ribbonWords.join(", ")}>
          <div className="ticker-track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="ticker-group" key={copy}>
                {Array.from({ length: 4 }, (_, repeat) =>
                  ribbonWords.map((word, index) => (
                    <span className="ticker-item" key={`${repeat}-${index}`}>
                      {word} <b>✳</b>
                    </span>
                  )),
                )}
              </div>
            ))}
          </div>
        </div>
        <section id="problem" className="problem-section site-container">
          <SectionHeading
            eyebrow="01 / ЗАДАЧА"
            title="Каждый день — маленькое решение с большим эффектом"
            description="Сколько испечь, чтобы гостям хватило, а в конце дня не осталось лишнего?"
          />
          <div className="problem-grid">
            <div className="problem-story reveal">
              <span className="story-number">01</span>
              <h3>Сегодня план строится на ощущениях</h3>
              <p>
                При ручном планировании легко переоценить спрос в тихий день или
                не успеть приготовить больше в оживлённый.
              </p>
              <div className="problem-tags">
                <span>Остатки</span>
                <span>Списания</span>
                <span>Упущенные продажи</span>
              </div>
            </div>
            <div className="solution-story reveal">
              <div className="solution-top">
                <span className="story-number">02</span>
                <span className="mini-spark">
                  <Sparkles size={19} />
                </span>
              </div>
              <div className="solution-body">
                <div className="solution-copy">
                  <h3>Economics превращает данные в план</h3>
                  <p>
                    Система собирает ваши записи о продажах и партиях, учитывает
                    день недели и доступные внешние условия, а затем показывает
                    понятную рекомендацию.
                  </p>
                </div>
                <div className="solution-visual">
                  <div className="mini-line">
                    <svg viewBox="0 0 400 85" preserveAspectRatio="none">
                      <path
                        d="M0 71 C45 67 52 45 90 54 S150 78 195 46 S252 57 300 23 S355 40 400 9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span>
                    Понятное решение
                    <br />
                    <strong>для каждой смены</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="workflow" className="workflow-section">
          <div className="site-container">
            <SectionHeading
              eyebrow="02 / ПРОЦЕСС"
              title="От первых записей — к точному плану"
              description="Четыре понятных шага, которые встраиваются в ежедневную работу команды."
            />
            <div className="steps-grid">
              {[
                {
                  n: "01",
                  i: <Package />,
                  t: "Добавьте продукты",
                  d: "Укажите время приготовления, свежесть и срок продажи.",
                },
                {
                  n: "02",
                  i: <BarChart3 />,
                  t: "Записывайте выпуск и продажи",
                  d: "Партии и продажи формируют историю и показывают остаток.",
                },
                {
                  n: "03",
                  i: <CalendarDays />,
                  t: "Смотрите план на завтра",
                  d: "Прогноз опирается на сопоставимые дни и текущие условия.",
                },
                {
                  n: "04",
                  i: <Activity />,
                  t: "Корректируйте в течение дня",
                  d: "Если спрос меняется, система подсказывает размер дополнительной партии.",
                },
              ].map((s) => (
                <div className="step-card reveal" key={s.n}>
                  <span className="step-index">{s.n}</span>
                  <div className="step-icon">{s.i}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                  <ArrowUpRight className="step-arrow" size={20} />
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="showcase-section site-container">
          <div className="showcase-copy reveal">
            <span className="eyebrow">03 / В ДЕЙСТВИИ</span>
            <h2>Цифры, за которыми видно решение.</h2>
            <p>
              В обзоре сразу понятно, сколько уже приготовлено, что продано и
              есть ли смысл запускать новую партию до закрытия.
            </p>
            <Link className="dark-link" to="/app">
              Перейти в приложение <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="showcase-board reveal">
            <div className="showcase-board-head">
              <span>
                <IconMark /> economics / Обзор
              </span>
              <span className="board-example">Условный пример</span>
            </div>
            <div className="showcase-board-title">
              План на завтра <span>↗</span>
            </div>
            <div className="board-chart">
              <div className="board-gridline" />
              <div className="board-gridline" />
              <div className="board-gridline" />
              {[35, 57, 46, 72, 59, 85, 68].map((v, i) => (
                <div className="board-col" key={i}>
                  <div style={{ height: `${v}%` }} />
                  <span>{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"][i]}</span>
                </div>
              ))}
            </div>
            <div className="board-bottom">
              <span>
                <span className="green-circle" /> Спрос на завтра
              </span>
              <strong>84 шт.</strong>
            </div>
            <div className="board-float">
              <span>Рекомендация</span>
              <strong>+15</strong>
              <small>приготовить сегодня</small>
            </div>
          </div>
        </section>
        <section id="capabilities" className="capabilities-section">
          <div className="site-container">
            <SectionHeading
              eyebrow="04 / ВОЗМОЖНОСТИ"
              title="Возможности для ежедневной работы"
              description="Записывайте выпуск и продажи, планируйте партии и следите за сроками."
            />
            <div className="capability-grid">
              <div className="capability-card now reveal">
                <div className="cap-label">
                  <span className="status-dot" /> ДОСТУПНО СЕЙЧАС
                </div>
                <h3>Всё для первого плана</h3>
                <ul>
                  <li>
                    <Check />
                    Каталог продуктов и партии
                  </li>
                  <li>
                    <Check />
                    Ручной учёт продаж и списаний
                  </li>
                  <li>
                    <Check />
                    Прогноз и рекомендации
                  </li>
                  <li>
                    <Check />
                    Предупреждения о сроках
                  </li>
                  <li>
                    <Check />
                    Погода по выбранному городу
                  </li>
                </ul>
              </div>
              <div className="capability-card insight reveal">
                <div className="cap-label">РЕШЕНИЯ НА ОСНОВЕ ДАННЫХ</div>
                <h3>Планирование и контроль сроков</h3>
                <ul>
                  <li>
                    <Check /> Предварительная оценка при ограниченной истории
                  </li>
                  <li>
                    <Check /> Подсказка по дополнительной партии
                  </li>
                  <li>
                    <Check /> Рекомендации для истекающих партий
                  </li>
                  <li>
                    <Check /> Учёт дня недели и основных праздников РФ
                  </li>
                  <li>
                    <Check /> Погода по выбранному городу при доступных данных
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <section id="contact" className="contact-section site-container">
          <div className="contact-copy reveal">
            <span className="eyebrow">05 / КОНТАКТ</span>
            <h2>
              Давайте печь
              <br />
              <em>точнее.</em>
            </h2>
            <p>Укажите имя и контактные данные.</p>
            <div className="contact-accent">
              <span>✳</span> Экономика начинается с ясного решения.
            </div>
          </div>
          <form
            className="contact-form reveal"
            onSubmit={submitContact}
            onInput={(e) => {
              if (e.target instanceof HTMLInputElement) {
                e.target.setCustomValidity("");
              }
            }}
          >
            <h3>Расскажите о себе</h3>
            <label>
              Ваше имя
              <input
                name="contactName"
                required
                placeholder="Как к вам обращаться"
              />
            </label>
            <label>
              Телефон
              <input
                name="contactPhone"
                required
                type="tel"
                placeholder="+7 (999) 000-00-00"
              />
            </label>
            <label>
              Электронная почта
              <input
                name="contactEmail"
                required
                type="email"
                placeholder="name@company.ru"
              />
            </label>
            <PrimaryButton type="submit">
              Заполнить форму <ArrowUpRight size={17} />
            </PrimaryButton>
          </form>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container footer-top">
          <Brand light />
          <p>Планируйте выпечку на основе данных.</p>
          <div>
            <a href="#problem">О продукте</a>
            <a href="#workflow">Как это работает</a>
            <a href="#contact">Контакты</a>
          </div>
        </div>
        <div className="site-container footer-bottom">
          <span>© {new Date().getFullYear()} Economics.</span>
        </div>
      </footer>
    </div>
  );
}

function Register({ setData }: { setData: Dispatch<SetStateAction<Data>> }) {
  const navigate = useNavigate();
  const [passwordError, setPasswordError] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = form.elements.namedItem("username") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;
    const confirmation = form.elements.namedItem(
      "confirmPassword",
    ) as HTMLInputElement;
    const businessName = form.elements.namedItem(
      "businessName",
    ) as HTMLInputElement;
    const city = form.elements.namedItem("city") as HTMLInputElement;

    for (const input of [username, businessName, city]) {
      if (!input.value.trim()) {
        input.setCustomValidity("Заполните это поле.");
        input.reportValidity();
        return;
      }
    }

    if (password.value !== confirmation.value) {
      setPasswordError("Пароли не совпадают.");
      confirmation.focus();
      return;
    }

    setPasswordError("");
    setData((d) => ({
      ...d,
      settings: {
        ...d.settings,
        businessName: businessName.value.trim(),
        city: city.value.trim(),
      },
    }));
    navigate("/app");
  };
  return (
    <div className="register-page">
      <div className="register-side">
        <Link to="/">
          <Brand light />
        </Link>
        <div>
          <span className="eyebrow">ВАШ СЛЕДУЮЩИЙ ДЕНЬ</span>
          <h1>
            Пусть каждый
            <br />
            замес будет
            <br />
            <em>к месту.</em>
          </h1>
          <p>Несколько записей сегодня — более ясный план завтра.</p>
        </div>
        <div className="register-decoration">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <small>Economics · планирование выпечки</small>
      </div>
      <div className="register-main">
        <Link to="/" className="back-home">
          <ArrowRight size={17} /> Вернуться на сайт
        </Link>
        <div className="register-form-wrap">
          <div className="pill">
            <span className="pulse-dot" /> Начните с основного
          </div>
          <h2>Создайте рабочее пространство</h2>
          <p>Укажите данные заведения для настройки рабочего пространства.</p>
          <form
            onSubmit={submit}
            onInput={(e) => {
              if (e.target instanceof HTMLInputElement) {
                e.target.setCustomValidity("");
                if (["password", "confirmPassword"].includes(e.target.name)) {
                  setPasswordError("");
                }
              }
            }}
          >
            <label>
              Логин
              <input
                name="username"
                required
                autoComplete="username"
                placeholder="Придумайте логин"
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                required
                type="password"
                autoComplete="new-password"
                placeholder="Придумайте пароль"
              />
            </label>
            <label>
              Повторите пароль
              <input
                name="confirmPassword"
                required
                type="password"
                autoComplete="new-password"
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? "password-error" : undefined}
                placeholder="Повторите пароль"
              />
              {passwordError && (
                <span
                  id="password-error"
                  className="register-error"
                  role="alert"
                >
                  {passwordError}
                </span>
              )}
            </label>
            <label>
              Название заведения
              <input
                name="businessName"
                required
                autoComplete="organization"
                placeholder="Например, Пекарня у дома"
              />
            </label>
            <label>
              Город
              <input
                name="city"
                required
                autoComplete="address-level2"
                placeholder="Москва"
              />
            </label>
            <PrimaryButton type="submit">
              Перейти в приложение <ArrowUpRight size={18} />
            </PrimaryButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function AppShell({
  data,
  setData,
  weather,
}: {
  data: Data;
  setData: Dispatch<SetStateAction<Data>>;
  weather: WeatherState;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [discardBatch, setDiscardBatch] = useState<Batch | null>(null);
  const [notice, setNotice] = useState("");
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const refresh = () => setNowTick((tick) => tick + 1);
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  const { now, views } = useMemo(() => {
    const now = new Date();
    return { now, views: batchViews(data, now) };
  }, [data, nowTick]);
  const alerts = views
    .filter((b) => b.remaining > 0 && b.status !== "fresh")
    .sort((a, b) => +a.expiresAt - +b.expiresAt);
  const openProduct = (p?: Product) => {
    setEditingProduct(p || null);
    setDialog("product");
  };
  const openSale = (s?: Sale) => {
    setEditingSale(s || null);
    setDialog("sale");
  };
  const openBatch = (b?: Batch) => {
    setEditingBatch(b || null);
    setDialog("batch");
  };
  const changeBatchDiscount = (batch: Batch, percent: number | null) => {
    const product = data.products.find((p) => p.id === batch.productId);
    if (percent !== null) {
      const view = batchViews(data, new Date()).find((b) => b.id === batch.id);
      if (!view || view.remaining <= 0 || view.status !== "aging") {
        setNotice(
          "Скидку можно применить только к партии с действующим сроком продажи.",
        );
        return;
      }
      if (
        !product ||
        product.price === undefined ||
        !Number.isFinite(product.price) ||
        product.price < 0
      ) {
        setNotice("Укажите обычную цену продукта перед применением скидки.");
        if (product) openProduct(product);
        return;
      }
    }
    setData((current) => ({
      ...current,
      batches: current.batches.map((item) =>
        item.id === batch.id
          ? {
              ...item,
              discount:
                percent === null || !product || product.price === undefined
                  ? undefined
                  : {
                      percent,
                      regularPrice: product.price,
                      unitPrice: money(product.price * (1 - percent / 100)),
                    },
            }
          : item,
      ),
    }));
    setNotice("");
  };
  const close = () => {
    setDialog(null);
    setDiscardBatch(null);
  };
  const nav = [
    {
      to: "/app",
      icon: <LayoutDashboard size={19} />,
      label: "Обзор",
      end: true,
    },
    {
      to: "/app/sales",
      icon: <BarChart3 size={19} />,
      label: "История продаж",
    },
    { to: "/app/products", icon: <Package size={19} />, label: "Продукты" },
    { to: "/app/chat", icon: <MessageCircle size={19} />, label: "Чат" },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar-brand">
          <Brand />
        </Link>
        <Link
          to="/app/settings"
          className="sidebar-workspace"
          aria-label={`Настройки рабочего пространства: ${data.settings.businessName || "Мой бизнес"}`}
        >
          <div className="workspace-avatar">
            {(data.settings.businessName || "Э").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span>РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <strong>{data.settings.businessName || "Мой бизнес"}</strong>
          </div>
          <ArrowUpRight size={15} />
        </Link>
        <div className="nav-caption">МЕНЮ</div>
        <nav className="side-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            to="/app/settings"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <SettingsIcon size={19} /> Настройки
          </NavLink>
          <div className="sidebar-help">
            <div className="help-icon">
              <Sparkles size={20} />
            </div>
            <strong>Решения на основе данных</strong>
            <p>Записывайте продажи, чтобы уточнять оценку спроса.</p>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="breadcrumbs">
            <span>Economics</span>
            <span>/</span>
            <strong>Рабочее пространство</strong>
          </div>
          <div className="topbar-right">
            <div className="topbar-weather">
              <CloudSun size={18} />
              {weather.status === "ready"
                ? weather.message
                : weather.status === "loading"
                  ? "Загружаем погоду"
                  : weather.status === "error"
                    ? "Погода недоступна"
                    : "Город не указан"}
            </div>
            <Link
              to="/app/settings"
              className="avatar-small"
              aria-label="Настройки"
            >
              {(data.settings.businessName || "Э").slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        {notice && (
          <div className="app-notice" role="alert">
            <Bell size={17} />
            {notice}
            <button onClick={() => setNotice("")} aria-label="Закрыть">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="app-content">
          <Routes>
            <Route
              index
              element={
                <Overview
                  {...{
                    data,
                    weather,
                    now,
                    views,
                    alerts,
                    openProduct,
                    openBatch,
                    openSale,
                    openWriteOff: setDiscardBatch,
                    changeBatchDiscount,
                  }}
                />
              }
            />
            <Route
              path="products"
              element={
                <ProductsPage
                  {...{
                    data,
                    views,
                    openProduct,
                    openBatch,
                    setData,
                    setDiscardBatch,
                    changeBatchDiscount,
                  }}
                />
              }
            />
            <Route
              path="sales"
              element={<SalesPage {...{ data, openSale, setData }} />}
            />
            <Route path="chat" element={<ChatPage />} />
            <Route
              path="settings"
              element={<SettingsPage {...{ data, setData, weather }} />}
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </div>
      </div>
      {dialog === "product" && (
        <ProductDialog
          data={data}
          product={editingProduct}
          onClose={close}
          onSave={(p) => {
            setData((d) => ({
              ...d,
              products: editingProduct
                ? d.products.map((x) => (x.id === p.id ? p : x))
                : [...d.products, p],
            }));
            setNotice("");
            close();
          }}
        />
      )}
      {dialog === "batch" && (
        <BatchDialog
          data={data}
          batch={editingBatch}
          onClose={close}
          onSave={(b) => {
            setData((d) => ({
              ...d,
              batches: editingBatch
                ? d.batches.map((x) => (x.id === b.id ? b : x))
                : [...d.batches, b],
            }));
            setNotice("");
            close();
          }}
        />
      )}
      {dialog === "sale" && (
        <SaleDialog
          data={data}
          sale={editingSale}
          onClose={close}
          onSave={(s) => {
            setData((d) => ({
              ...d,
              sales: editingSale
                ? d.sales.map((x) => (x.id === s.id ? s : x))
                : [...d.sales, s],
            }));
            setNotice("");
            close();
          }}
        />
      )}
      {discardBatch && (
        <DiscardDialog
          batch={discardBatch}
          product={data.products.find((p) => p.id === discardBatch.productId)}
          maximum={views.find((v) => v.id === discardBatch.id)?.remaining || 0}
          onClose={close}
          onSave={(qty) => {
            setData((d) => ({
              ...d,
              batches: d.batches.map((b) =>
                b.id === discardBatch.id
                  ? { ...b, discarded: b.discarded + qty }
                  : b,
              ),
            }));
            setNotice("");
            close();
          }}
        />
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
  foot,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  foot: string;
  tone?: "neutral" | "green" | "orange";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}
function StockCoverage({ stock, demand }: { stock: number; demand: number }) {
  const scale = Math.max(1, stock, demand);
  const shortfall = Math.max(0, demand - stock);
  const explanation =
    demand === 0
      ? "До закрытия дополнительный спрос не ожидается."
      : shortfall > 0
        ? `Ожидаемый спрос превышает остаток на ${fmt(shortfall)}`
        : "Текущего остатка хватает на ожидаемые продажи до закрытия.";
  return (
    <div
      className={`decision-indicator${shortfall ? " has-shortfall" : ""}`}
      tabIndex={0}
      role="group"
      aria-label={`В наличии ${fmt(stock)} Ожидается продать до закрытия ${fmt(demand)} ${explanation}`}
    >
      <div className="decision-indicator-track" aria-hidden="true">
        <span
          className="decision-indicator-stock"
          style={{ width: `${(stock / scale) * 100}%` }}
        />
        {shortfall > 0 && (
          <span
            className="decision-indicator-shortfall"
            style={{
              left: `${(stock / scale) * 100}%`,
              width: `${(shortfall / scale) * 100}%`,
            }}
          />
        )}
        {demand > 0 && <i style={{ left: `${(demand / scale) * 100}%` }} />}
      </div>
      <div className="decision-indicator-labels">
        <span>
          В наличии <b>{fmt(stock)}</b>
        </span>
        <span>
          До закрытия <b>{fmt(demand)}</b>
        </span>
      </div>
      <span className="decision-indicator-state">
        {shortfall > 0 ? `Не хватает ${fmt(shortfall)}` : explanation}
      </span>
      <div className="decision-indicator-tooltip" role="tooltip">
        <strong>Покрытие спроса</strong>
        <span>
          В наличии: {fmt(stock)} · ожидается продать: {fmt(demand)}
        </span>
        <span>{explanation}</span>
      </div>
    </div>
  );
}
function MorningShare({
  morning,
  demand,
}: {
  morning: number;
  demand: number;
}) {
  const percent = demand > 0 ? Math.round((morning / demand) * 100) : null;
  const explanation =
    demand > 0
      ? `Первая партия покрывает около ${percent}% дневной оценки. Остальное можно приготовить позже, ориентируясь на продажи.`
      : "Ожидаемый спрос равен нулю; долю первой партии не рассчитываем.";
  return (
    <div
      className="decision-indicator morning-indicator"
      tabIndex={0}
      role="group"
      aria-label={`Первая партия ${fmt(morning)} из дневной оценки ${fmt(demand)} ${explanation}`}
    >
      <div className="decision-indicator-track" aria-hidden="true">
        {demand > 0 && (
          <span
            className="decision-indicator-stock"
            style={{ width: `${Math.min(100, (morning / demand) * 100)}%` }}
          />
        )}
      </div>
      <div className="decision-indicator-labels">
        <span>
          Первая партия <b>{fmt(morning)}</b>
        </span>
        <span>
          За день <b>{fmt(demand)}</b>
        </span>
      </div>
      <span className="decision-indicator-state">
        {percent === null
          ? "Доля не рассчитывается"
          : `${percent}% дневной оценки`}
      </span>
      <div className="decision-indicator-tooltip" role="tooltip">
        <strong>Доля утреннего выпуска</strong>
        <span>
          Приготовить утром: {fmt(morning)} · спрос за день: {fmt(demand)}
        </span>
        <span>{explanation}</span>
      </div>
    </div>
  );
}
function TomorrowWeatherCard({
  weather,
  impact,
  adjustment,
  missingLocation,
}: {
  weather?: Weather;
  impact: ReturnType<typeof describeTomorrowWeather>;
  adjustment?: number;
  missingLocation: boolean;
}) {
  const icon = !weather ? (
    impact.title === "Загружаем погоду" ? (
      <CloudSun size={22} />
    ) : (
      <CloudOff size={22} />
    )
  ) : weather.code >= 51 ? (
    <CloudRain size={22} />
  ) : weather.code >= 3 ? (
    <CloudSun size={22} />
  ) : (
    <Sun size={22} />
  );
  const result = impact.kind === "adjusted"
    ? `прогноз спроса ${adjustment === -0.05 ? "−5%" : "−3%"}`
    : impact.kind === "context"
      ? "оценка спроса пока недоступна"
      : "без погодной поправки";
  return <WeatherBrief
    day="ЗАВТРА"
    icon={icon}
    summary={missingLocation ? "Укажите город для прогноза погоды" : `${impact.conditions} · ${result}`}
    detail={missingLocation ? "Погодные данные станут доступны после выбора города в настройках." : impact.detail}
    note={impact.note}
    adjusted={impact.kind === "adjusted"}
  />;
}
function WeatherBrief({ day, icon, summary, detail, note, adjusted = false }: {
  day: string;
  icon: ReactNode;
  summary: string;
  detail: string;
  note?: string;
  adjusted?: boolean;
}) {
  return (
    <details className={`overview-weather${adjusted ? " is-adjusted" : ""}`}>
      <summary>
        <span className="overview-weather-icon" aria-hidden="true">{icon}</span>
        <span className="overview-weather-copy">
          <small>ПОГОДА · {day}</small>
          <strong aria-live="polite">{summary}</strong>
        </span>
        <span className="overview-weather-more">
          <span className="overview-weather-closed">Подробнее</span>
          <span className="overview-weather-open">Свернуть</span>
          <ChevronDown size={15} />
        </span>
      </summary>
      <div className="overview-weather-detail">
        <p>{detail}</p>
        {note && <small>{note}</small>}
      </div>
    </details>
  );
}
function TodayWeatherCard({
  weather, loading, hasEstimate, currentTime, missingLocation,
}: {
  weather: TodayWeather;
  loading: boolean;
  hasEstimate: boolean;
  currentTime: string;
  missingLocation: boolean;
}) {
  const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 })
    .format(-weather.adjustment * 100);
  const change = weather.rainMinutes > 0
    ? `${weather.firstRain && weather.firstRain <= currentTime ? "Сейчас ожидаются" : `После ${weather.firstRain} ожидаются`} осадки`
    : weather.heatMinutes > 0
      ? `${weather.firstHeat && weather.firstHeat <= currentTime ? "Сейчас ожидается" : `После ${weather.firstHeat} ожидается`} жара`
      : "Осадков и сильной жары до закрытия не ожидается";
  const conditions = weather.kind === "available"
    ? weather.rainMinutes > 0
      ? `${weather.firstRain && weather.firstRain <= currentTime ? "Осадки сейчас" : `Осадки после ${weather.firstRain}`}`
      : weather.heatMinutes > 0
        ? `${weather.firstHeat && weather.firstHeat <= currentTime ? "Жара сейчас" : `Жара после ${weather.firstHeat}`}`
        : weather.conditions || "Погода до закрытия"
    : weather.kind === "closed"
      ? "Рабочий день завершён"
      : weather.kind === "hours"
        ? "Укажите часы работы в настройках"
        : missingLocation ? "Укажите город в настройках" : loading ? "Загружаем почасовую погоду" : "Почасовая погода недоступна";
  const summary = weather.kind === "available"
    ? `${conditions} · ${!hasEstimate ? "оценка спроса пока недоступна" : weather.adjustment < 0 ? `поправка −${percent}%` : "без погодной поправки"}`
    : conditions;
  const detail = weather.kind === "available"
    ? !hasEstimate
      ? "Для оценки спроса нужны данные о продажах. Погода сама по себе не задаёт количество."
      : weather.adjustment < 0
        ? `Расчётная поправка к спросу до закрытия: −${percent}%. Условное правило модели: осадки −5%, жара −3% пропорционально затронутым часам; итог округлён до штук.`
        : "Погода не изменила оценку спроса до закрытия."
    : weather.kind === "closed"
      ? "Дополнительный выпуск на сегодня не рекомендуется."
      : weather.kind === "hours"
        ? "Без рабочих часов погодную поправку для оставшейся смены рассчитать нельзя."
        : missingLocation
          ? "Для местного времени и погоды укажите город. Пока используется время устройства."
          : hasEstimate
            ? "Оценка спроса рассчитана без погодной поправки."
            : "Для оценки спроса нужны данные о продажах; погода не задаёт количество.";
  return <WeatherBrief
    day="СЕГОДНЯ"
    icon={weather.kind === "available" ? weather.rainMinutes > 0 ? <CloudRain size={20} /> : weather.heatMinutes > 0 ? <Sun size={20} /> : <CloudSun size={20} /> : <CloudOff size={20} />}
    summary={summary}
    detail={weather.kind === "available" ? `${weather.conditions}. ${change}. ${detail}` : detail}
    adjusted={weather.adjustment < 0 && hasEstimate}
  />;
}
function ForecastExplanation({
  estimate,
  morning,
  product,
  weather,
  target,
  loading,
}: {
  estimate: ReturnType<typeof forecast>;
  morning: number | null;
  product: Product;
  weather?: Weather;
  target: Date;
  loading: boolean;
}) {
  const impact = describeTomorrowWeather(weather, estimate, loading);
  const day = target.toLocaleDateString("ru-RU", { weekday: "long" });
  const reasons = estimate.reasons.filter(
    (reason) => !reason.startsWith("Погода"),
  );
  return (
    <details className="morning-explanation">
      <summary>
        Как сформирован прогноз <ChevronDown size={15} />
      </summary>
      <div className="morning-explanation-body">
        {estimate.amount === null ? (
          <>
            <p>Оценка пока не рассчитана: нужны записи о продажах.</p>
            <p>
              {`Завтра — ${day}. ${weather ? `Погода: ${impact.conditions}.` : "Погодных данных нет."} Эти сведения сами по себе не задают количество.`}
            </p>
          </>
        ) : (
          <>
            {estimate.preliminary && (
              <p className="explanation-preliminary">
                Предварительная оценка: история продаж пока ограничена.
              </p>
            )}
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
              <li>{`Погода: ${impact.conditions}. ${impact.detail}${impact.note ? ` ${impact.note}` : ""}`}</li>
              <li>{`Первую партию определяют срок свежести (${product.freshnessHours} ч), срок продажи (${product.shelfHours} ч) и часы работы.`}</li>
            </ul>
            <div className="morning-explanation-result">
              <span>
                Спрос за день <b>{fmt(estimate.amount)}</b>
              </span>
              <span>
                Приготовить утром{" "}
                <b>{morning === null ? "Нет оценки" : fmt(morning)}</b>
              </span>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
function Overview({
  data,
  weather,
  now,
  alerts,
  openProduct,
  openBatch,
  openSale,
  openWriteOff,
  changeBatchDiscount,
}: {
  data: Data;
  weather: WeatherState;
  now: Date;
  views: ReturnType<typeof batchViews>;
  alerts: ReturnType<typeof batchViews>;
  openProduct: (p?: Product) => void;
  openBatch: (b?: Batch) => void;
  openSale: (s?: Sale) => void;
  openWriteOff: (b: Batch) => void;
  changeBatchDiscount: (b: Batch, percent: number | null) => void;
}) {
  const [period, setPeriod] = useState<"today" | "tomorrow">("today");
  const [forecastQuery, setForecastQuery] = useState("");
  const clock = businessClock(now, weather.timeZone);
  const currentTime = `${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
  const t = new Date(`${clock.date}T12:00`);
  t.setDate(t.getDate() + 1);
  const weatherTomorrow = weather.items.find((w) => w.date === dateKey(t));
  const todayWeather = assessTodayWeather(weather.hourly, data.settings, now, weather.timeZone);
  const recs = data.products.map((p) => ({
    product: p,
    tomorrow: forecast(data, p.id, t, weatherTomorrow, now, weather.timeZone),
    today: todayRecommendation(data, p.id, todayWeather, now, weather.timeZone),
    producedToday: data.batches
      .filter(
        (b) =>
          b.productId === p.id &&
          businessDateKey(new Date(b.preparedAt), weather.timeZone) === clock.date,
      )
      .reduce((n, b) => n + b.quantity, 0),
    soldToday: data.sales
      .filter(
        (s) =>
          s.productId === p.id && businessDateKey(new Date(s.soldAt), weather.timeZone) === clock.date,
      )
      .reduce((n, s) => n + s.quantity, 0),
    producedEarlier: data.batches
      .filter(
        (b) =>
          b.productId === p.id &&
          +new Date(b.preparedAt) < +now &&
          businessDateKey(new Date(b.preparedAt), weather.timeZone) !== clock.date,
      )
      .reduce((n, b) => n + b.quantity, 0),
  }));
  const tomorrowRows = recs
    .filter(({ product }) =>
      product.name.toLowerCase().includes(forecastQuery.trim().toLowerCase()),
    )
    .map((item) => ({
      ...item,
      initial:
        item.tomorrow.amount === null
          ? null
          : initialPlan(data, item.product, item.tomorrow.amount).quantity,
    }));
  const weatherImpact = describeTomorrowWeather(
    weatherTomorrow,
    recs.find((item) => item.tomorrow.amount !== null)?.tomorrow,
    weather.status === "loading",
  );
  const producedToday = data.batches
    .filter((b) => businessDateKey(new Date(b.preparedAt), weather.timeZone) === clock.date)
    .reduce((n, b) => n + b.quantity, 0);
  const soldToday = data.sales
    .filter((s) => businessDateKey(new Date(s.soldAt), weather.timeZone) === clock.date)
    .reduce((n, s) => n + s.quantity, 0);
  const stock = data.products.reduce(
    (n, p) => n + availableFor(data, p.id, now),
    0,
  );
  const expiring = alerts.filter((a) => a.status === "aging").length;
  const expired = alerts.filter((a) => a.status === "expired").length;
  return (
    <>
      <PageTitle
        eyebrow="РАБОЧИЙ СТОЛ"
        title={`Добрый день${data.settings.businessName ? `, ${data.settings.businessName}` : ""}`}
        description={`${ruToday()} · Ваша смена в одном месте`}
      />
      <div className="overview-tabs" role="tablist" aria-label="Период обзора">
        <button
          type="button"
          role="tab"
          aria-selected={period === "today"}
          onClick={() => setPeriod("today")}
        >
          <span>Сегодня</span>
          <small>Выпуск, остатки и решения</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === "tomorrow"}
          onClick={() => setPeriod("tomorrow")}
        >
          <span>Завтра</span>
          <small>Спрос и план выпуска</small>
        </button>
      </div>
      <div className="overview-weather-row" key={period}>
        {period === "today" ? (
          <TodayWeatherCard
            weather={todayWeather}
            loading={weather.status === "loading"}
            hasEstimate={recs.some((item) => item.today.amount !== null)}
            currentTime={currentTime}
            missingLocation={!data.settings.city.trim()}
          />
        ) : (
          <TomorrowWeatherCard
            weather={weatherTomorrow}
            impact={weatherImpact}
            adjustment={recs.find((item) => item.tomorrow.amount !== null)?.tomorrow.weatherAdjustment}
            missingLocation={!data.settings.city.trim()}
          />
        )}
      </div>
      {data.products.length === 0 && period === "tomorrow" ? (
        <div className="panel forecast-panel empty-tomorrow-panel">
          <div className="panel-head">
            <div>
              <span className="page-eyebrow">ПЛАНИРОВАНИЕ</span>
              <h2>Сколько приготовить утром</h2>
              <p>{tomorrowLabel()}</p>
            </div>
          </div>
          <p>
            Добавьте первый продукт и записывайте выпуск и продажи. После первых
            продаж здесь появится предварительная оценка количества.
          </p>
          <PrimaryButton onClick={() => openProduct()}>
            <Plus size={18} /> Добавить продукт
          </PrimaryButton>
        </div>
      ) : data.products.length === 0 ? (
        <div className="welcome-card">
          <div className="welcome-copy">
            <span className="eyebrow">НАЧНЁМ С ОСНОВНОГО</span>
            <h2>Ваш ясный план начинается здесь.</h2>
            <p>
              Добавьте первый продукт, затем записывайте партии и продажи. После
              первых продаж появится предварительный ориентир спроса.
            </p>
            <PrimaryButton onClick={() => openProduct()}>
              <Plus size={18} /> Добавить продукт
            </PrimaryButton>
          </div>
          <div className="welcome-art">
            <div className="welcome-ring ring-1" />
            <div className="welcome-ring ring-2" />
            <div className="welcome-card-small">
              <IconMark />
              <span>
                Прогноз
                <br />
                <b>завтрашнего дня</b>
              </span>
              <ArrowUpRight size={18} />
            </div>
            <div className="welcome-bars">
              {[45, 65, 52, 82, 70].map((h, i) => (
                <span style={{ height: `${h}%` }} key={i} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {period === "today" ? (
            <>
              <section className="panel production-panel">
                <div className="panel-head">
                  <div>
                    <span className="page-eyebrow">РЕШЕНИЯ НА СЕГОДНЯ</span>
                    <h2>Что приготовить сейчас</h2>
                    <p>
                      Остаток, ожидаемые продажи и время до закрытия по каждому
                      товару
                    </p>
                  </div>
                  {alerts.length ? (
                    <span className="production-alert-count" role="status">
                      <Bell size={15} />
                      {expired
                        ? `Истёк срок: ${expired}`
                        : `Скоро истекает: ${expiring}`}
                    </span>
                  ) : (
                    <Activity size={20} />
                  )}
                </div>
                <div className="decision-grid">
                  {recs.map(({ product, today: recommendation }) => {
                    const remaining = recommendation.remainingDemand;
                    const shortage =
                      remaining === null
                        ? null
                        : Math.max(0, remaining - recommendation.available);
                    const state =
                      todayWeather.kind === "closed"
                        ? "closed"
                        : todayWeather.kind === "hours"
                          ? "unknown"
                      : recommendation.amount === null
                        ? "unknown"
                        : shortage && !recommendation.canPrepare
                          ? "late"
                          : recommendation.extra > 0
                            ? "prepare"
                            : "covered";
                    const headline =
                      state === "closed"
                        ? "Смена завершена"
                      : state === "unknown"
                        ? "Пока нет оценки спроса"
                        : state === "late"
                          ? "До закрытия не успеть"
                          : state === "prepare"
                            ? `Допеките ${fmt(recommendation.extra)}`
                            : "Пока допекать не нужно";
                    const explanation =
                      state === "closed"
                        ? "Новая партия на сегодня не требуется. Остатки и сроки годности доступны ниже."
                      : state === "unknown"
                        ? todayWeather.kind === "hours"
                          ? "Укажите часы работы, чтобы оценить спрос до закрытия. Остаток и сроки партий уже доступны."
                          : "Запишите продажи, чтобы оценить спрос до закрытия. Остаток и сроки партий уже доступны."
                        : state === "late"
                          ? `Ожидаемый спрос превышает остаток на ${fmt(shortage || 0)} Новая партия не успеет приготовиться до закрытия.`
                          : state === "prepare"
                            ? `До закрытия ожидается продать больше, чем сейчас доступно, на ${fmt(recommendation.extra)}`
                            : remaining === 0
                              ? "До закрытия дополнительный спрос не ожидается."
                              : "Текущего остатка достаточно для ожидаемых продаж до закрытия.";
                    const readyAt = new Date(
                      +now + product.prepMinutes * 60000,
                    ).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <article
                        className={`decision-card is-${state}`}
                        key={product.id}
                      >
                        <div className="decision-card-top">
                          <ProductThumb product={product} />
                          <div className="decision-card-name">
                            <strong title={product.name}>{product.name}</strong>
                            {recommendation.amount !== null &&
                              recommendation.preliminary && (
                                <span>Предварительная оценка</span>
                              )}
                          </div>
                          <span className={`decision-status is-${state}`}>
                            {state === "closed"
                              ? "ЗАКРЫТО"
                              : state === "prepare"
                              ? "НУЖЕН ВЫПУСК"
                              : state === "late"
                                ? "НЕ ХВАТАЕТ ВРЕМЕНИ"
                                : state === "covered"
                                  ? "ОСТАТКА ХВАТАЕТ"
                                  : "НУЖНЫ ПРОДАЖИ"}
                          </span>
                        </div>
                        <strong className="decision-headline">
                          {headline}
                        </strong>
                        <p className="decision-explanation">{explanation}</p>
                        {remaining === null ? (
                          <div className="decision-stock-only">
                            В наличии: <b>{fmt(recommendation.available)}</b>
                          </div>
                        ) : (
                          <StockCoverage
                            stock={recommendation.available}
                            demand={remaining}
                          />
                        )}
                        <div className="decision-card-foot">
                          <span>
                            Время приготовления: {product.prepMinutes} мин.
                          </span>
                          {state === "prepare" && (
                            <strong>Готово примерно к {readyAt}</strong>
                          )}
                        </div>
                        {recommendation.amount === null ? (
                          <button
                            type="button"
                            className="decision-card-action"
                            onClick={() =>
                              recommendation.available > 0
                                ? openSale()
                                : openBatch()
                            }
                          >
                            {recommendation.available > 0
                              ? "Записать продажу"
                              : "Добавить партию"}
                            <ArrowRight size={14} />
                          </button>
                        ) : (
                          <details className="decision-details">
                            <summary>Как получена оценка</summary>
                            <p>
                              {recommendation.reasons.join(" · ")}
                              {recommendation.paceIncreased
                                ? " · Сегодняшний темп повысил оценку."
                                : ""}
                            </p>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
              <div className="overview-today-support">
                <ExpirationAlerts
                  data={data}
                  alerts={alerts}
                  now={now}
                  openWriteOff={openWriteOff}
                  changeBatchDiscount={changeBatchDiscount}
                />
                <div className="metrics-grid">
                  <Metric
                    label="Приготовлено сегодня"
                    value={fmt(producedToday)}
                    icon={<Wheat size={20} />}
                    foot="По записанным партиям"
                  />
                  <Metric
                    label="Продано сегодня"
                    value={fmt(soldToday)}
                    icon={<TrendingUp size={20} />}
                    foot="По истории продаж"
                    tone="green"
                  />
                  <Metric
                    label="Доступно к продаже"
                    value={fmt(stock)}
                    icon={<Package size={20} />}
                    foot="Без истёкших партий"
                  />
                  <Metric
                    label="Скоро истекает"
                    value={`${expiring} ${plural(expiring, "партия", "партии", "партий")}`}
                    icon={<Clock3 size={20} />}
                    foot="Проверьте сроки"
                    tone="orange"
                  />
                </div>
              </div>
            </>
          ) : (
            <section className="panel morning-panel">
              <div className="panel-head">
                <div>
                  <span className="page-eyebrow">ПЛАН НА ЗАВТРА</span>
                  <h2>Сколько приготовить утром</h2>
                  <p>{tomorrowLabel()}</p>
                </div>
              </div>
              <div className="forecast-list-toolbar">
                <div>
                  <strong>Первый утренний выпуск по товарам</strong>
                  <small>Дневной спрос показан отдельно от первой партии</small>
                </div>
                <label className="chart-search">
                  <Search size={15} />
                  <input
                    value={forecastQuery}
                    onChange={(event) => setForecastQuery(event.target.value)}
                    placeholder="Найти продукт"
                    aria-label="Найти продукт в плане"
                  />
                </label>
              </div>
              {recs.every((item) => item.tomorrow.amount === null) && (
                <p className="forecast-empty-note">
                  Для расчёта пока мало продаж. Запишите продажи после выпуска
                  первой партии.
                </p>
              )}
              <div className="morning-grid">
                {tomorrowRows.length ? (
                  tomorrowRows.map((item) => (
                    <article className="morning-card" key={item.product.id}>
                      <div className="morning-card-top">
                        <ProductThumb product={item.product} />
                        <div>
                          <strong title={item.product.name}>
                            {item.product.name}
                          </strong>
                          {item.tomorrow.preliminary &&
                            item.tomorrow.amount !== null && (
                              <span>Предварительная оценка</span>
                            )}
                        </div>
                      </div>
                      <div className="morning-result">
                        <span>Приготовить утром</span>
                        <strong>
                          {item.initial === null
                            ? "Нет оценки"
                            : fmt(item.initial)}
                        </strong>
                      </div>
                      {item.tomorrow.amount === null ? (
                        <>
                          <p className="morning-missing">
                            Пока нет основы для расчёта. Запишите продажи, чтобы
                            получить предварительный план.
                          </p>
                          <button
                            type="button"
                            className="decision-card-action"
                            onClick={() =>
                              availableFor(data, item.product.id, now) > 0
                                ? openSale()
                                : openBatch()
                            }
                          >
                            {availableFor(data, item.product.id, now) > 0
                              ? "Записать продажу"
                              : "Добавить партию"}
                            <ArrowRight size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="morning-demand">
                            Ожидаемый спрос за весь день:{" "}
                            <b>{fmt(item.tomorrow.amount)}</b>
                          </p>
                          <MorningShare
                            morning={item.initial!}
                            demand={item.tomorrow.amount}
                          />
                          <p className="morning-followup">
                            Первую партию можно дополнить позже по фактическим
                            продажам.
                          </p>
                        </>
                      )}
                      <ForecastExplanation
                        estimate={item.tomorrow}
                        morning={item.initial}
                        product={item.product}
                        weather={weatherTomorrow}
                        target={t}
                        loading={weather.status === "loading"}
                      />
                      <div className="morning-context">
                        Сегодня для контекста: выпущено{" "}
                        {`${fmt(item.producedToday)}, продано ${fmt(item.soldToday)}`}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="forecast-empty-note">
                    По запросу товары не найдены.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
function ExpirationAlerts({
  data,
  alerts,
  now,
  openWriteOff,
  changeBatchDiscount,
}: {
  data: Data;
  alerts: ReturnType<typeof batchViews>;
  now: Date;
  openWriteOff: (b: Batch) => void;
  changeBatchDiscount: (b: Batch, percent: number | null) => void;
}) {
  const entries = alerts.flatMap((batch) => {
    const product = data.products.find((p) => p.id === batch.productId);
    const advice = product
      ? expirationAdvice(batch, product.shelfHours, now)
      : null;
    return product && advice ? [{ batch, product, advice }] : [];
  });
  return (
    <div className={`panel alerts-panel${entries.length ? " has-alerts" : ""}`}>
      <div className="panel-head">
        <div>
          <span className="page-eyebrow">КОНТРОЛЬ КАЧЕСТВА</span>
          <h2>Сроки партий</h2>
        </div>
        <Bell size={20} />
      </div>
      {entries.length ? (
        <div className="alerts-list">
          {entries.map(({ batch, product, advice }) => (
            <div key={batch.id} className={`alert-item ${advice.kind}`}>
              <span className="alert-dot" />
              <div className="alert-content">
                <span className="alert-category">
                  {advice.kind === "expired"
                    ? "НЕЛЬЗЯ ПРОДАВАТЬ"
                    : "СРОК СКОРО ИСТЕЧЁТ"}
                </span>
                <strong>{product.name}</strong>
                <span className="alert-batch">
                  Партия №{batch.id.slice(0, 8)} · приготовлена{" "}
                  {shortDateTime(batch.preparedAt)}
                </span>
                <p>
                  Остаток: {fmt(batch.remaining)} ·{" "}
                  {advice.kind === "expired"
                    ? `срок истёк ${shortDateTime(batch.expiresAt)}`
                    : `до окончания ${remainingTime(advice.minutesLeft)}`}
                </p>
                {advice.kind === "expired" ? (
                  <>
                    <p className="alert-explanation">
                      Партия недоступна к продаже. Запишите списание остатка.
                    </p>
                    <button
                      type="button"
                      className="alert-writeoff"
                      onClick={() => openWriteOff(batch)}
                    >
                      Записать списание <ArrowRight size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="alert-price">
                      Обычная цена:{" "}
                      {product.price === undefined
                        ? "не указана"
                        : rub(product.price)}
                    </p>
                    <span className="discount-recommendation">
                      Рекомендация: скидка {advice.discountPercent}%
                      {product.price !== undefined &&
                        ` · ${rub(money(product.price * (1 - advice.discountPercent / 100)))}/шт.`}
                    </span>
                    {batch.discount && (
                      <p className="alert-applied">
                        Применено к партии: {batch.discount.percent}% ·{" "}
                        {rub(batch.discount.regularPrice)} →{" "}
                        {rub(batch.discount.unitPrice)}/шт.
                      </p>
                    )}
                    <p className="alert-explanation">
                      По оставшемуся сроку партии: не более{" "}
                      {advice.discountPercent === 30
                        ? "1 часа"
                        : advice.discountPercent === 20
                          ? "2 часов"
                          : "4 часов"}{" "}
                      до окончания. Цена меняется только после применения в
                      Economics; касса не обновляется.
                    </p>
                    <div className="discount-actions">
                      {batch.discount?.percent !== advice.discountPercent && (
                        <button
                          type="button"
                          onClick={() =>
                            changeBatchDiscount(batch, advice.discountPercent)
                          }
                        >
                          {batch.discount
                            ? "Обновить скидку"
                            : "Применить скидку"}
                        </button>
                      )}
                      {batch.discount && (
                        <button
                          type="button"
                          className="discount-remove"
                          onClick={() => changeBatchDiscount(batch, null)}
                        >
                          Снять скидку
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-block">
          Активных предупреждений нет. Система следит за временем каждой партии.
        </p>
      )}
    </div>
  );
}
function ProductThumb({ product }: { product: Product }) {
  return (
    <div className="product-thumb">
      {product.image ? <img src={product.image} alt="" /> : <Wheat size={22} />}
    </div>
  );
}
function ProductsPage({
  data,
  views,
  openProduct,
  openBatch,
  setData,
  setDiscardBatch,
  changeBatchDiscount,
}: {
  data: Data;
  views: ReturnType<typeof batchViews>;
  openProduct: (p?: Product) => void;
  openBatch: (b?: Batch) => void;
  setData: Dispatch<SetStateAction<Data>>;
  setDiscardBatch: (b: Batch | null) => void;
  changeBatchDiscount: (b: Batch, percent: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const products = data.products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const activeBatches = [...views].sort(
    (a, b) => +new Date(b.preparedAt) - +new Date(a.preparedAt),
  );
  const deleteProduct = (p: Product) => {
    if (window.confirm(`Удалить «${p.name}» вместе с партиями и продажами?`))
      setData((d) => ({
        ...d,
        products: d.products.filter((x) => x.id !== p.id),
        batches: d.batches.filter((x) => x.productId !== p.id),
        sales: d.sales.filter((x) => x.productId !== p.id),
      }));
  };
  const deleteBatch = (b: Batch) => {
    const next = {
      ...data,
      batches: data.batches.filter((x) => x.id !== b.id),
    };
    if (!salesFitBatches(next)) {
      window.alert(
        "Партию нельзя удалить: к ней относятся записанные продажи.",
      );
      return;
    }
    if (window.confirm("Удалить партию?")) setData(next);
  };
  return (
    <>
      <PageTitle
        eyebrow="КАТАЛОГ И СКЛАД"
        title="Продукты"
        description="Данные о продукте, партиях и сроках продажи в одном месте."
        action={
          <div className="title-actions">
            <button
              className="secondary-button"
              onClick={() => openBatch()}
              disabled={!data.products.length}
            >
              <Plus size={17} /> Новая партия
            </button>
            <PrimaryButton onClick={() => openProduct()} className="compact">
              <Plus size={17} /> Добавить продукт
            </PrimaryButton>
          </div>
        }
      />
      {!data.products.length ? (
        <EmptyState
          icon={<Package size={34} />}
          title="Каталог пока пуст"
          description="Добавьте продукт и укажите время приготовления, свежесть и срок продажи. Затем можно записать первую партию."
          action={
            <PrimaryButton onClick={() => openProduct()}>
              <Plus size={17} /> Добавить продукт
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="list-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Найти продукт"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span>
              {products.length}{" "}
              {plural(products.length, "продукт", "продукта", "продуктов")}
            </span>
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <div className="product-card" key={p.id}>
                <div className="product-card-top">
                  <ProductThumb product={p} />
                  <div className="product-card-actions">
                    <button
                      aria-label="Редактировать"
                      onClick={() => openProduct(p)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      aria-label="Удалить"
                      onClick={() => deleteProduct(p)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <h3>{p.name}</h3>
                <div className="product-price">
                  {p.price === undefined
                    ? "Цена не указана"
                    : `${rub(p.price)} / шт.`}
                </div>
                <p>{p.description || "Описание пока не добавлено"}</p>
                <div className="product-details">
                  <span>
                    <b>{p.weight} г</b> Вес
                  </span>
                  <span>
                    <b>{p.prepMinutes} мин</b> Приготовление
                  </span>
                  <span>
                    <b>{hours(p.freshnessHours)}</b> Свежесть
                  </span>
                  <span>
                    <b>{hours(p.shelfHours)}</b> Продажа
                  </span>
                </div>
                <div className="product-card-bottom">
                  <div>
                    <small>Доступно сейчас</small>
                    <strong>{fmt(availableFor(data, p.id))}</strong>
                  </div>
                  <button onClick={() => openBatch()}>
                    Добавить партию <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="panel batch-panel">
            <div className="panel-head">
              <div>
                <span className="page-eyebrow">УЧЁТ ПРОИЗВОДСТВА</span>
                <h2>Партии</h2>
              </div>
              <span className="table-count">
                {views.length}{" "}
                {plural(views.length, "запись", "записи", "записей")}
              </span>
            </div>
            {!views.length ? (
              <div className="inline-empty">
                Партии пока не добавлены.{" "}
                <button onClick={() => openBatch()}>
                  Записать первую <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ПРОДУКТ</th>
                      <th>ПРИГОТОВЛЕНО</th>
                      <th>ОСТАТОК</th>
                      <th>ЦЕНА ПАРТИИ</th>
                      <th>ВРЕМЯ ВЫПУСКА</th>
                      <th>ПРОДАТЬ ДО</th>
                      <th>СТАТУС</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatches.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div className="table-product">
                            <ProductThumb
                              product={data.products.find(
                                (p) => p.id === b.productId,
                              )!}
                            />
                            <strong>
                              {data.products.find((p) => p.id === b.productId)
                                ?.name || "Продукт удалён"}
                            </strong>
                          </div>
                        </td>
                        <td>{fmt(b.quantity)}</td>
                        <td>
                          <strong>{fmt(b.remaining)}</strong>
                          {b.discarded > 0 && (
                            <small>Списано: {fmt(b.discarded)}</small>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const product = data.products.find(
                              (p) => p.id === b.productId,
                            );
                            if (!product) return "—";
                            const price = batchPrice(product, b);
                            return (
                              <div className="batch-price-cell">
                                <strong>
                                  {price.unitPrice === null
                                    ? "Цена не указана"
                                    : rub(price.unitPrice)}
                                </strong>
                                {b.discount && (
                                  <>
                                    <small>
                                      Обычно {rub(b.discount.regularPrice)} ·
                                      скидка {b.discount.percent}%
                                    </small>
                                    <button
                                      onClick={() =>
                                        changeBatchDiscount(b, null)
                                      }
                                    >
                                      Снять скидку
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td>{shortDateTime(b.preparedAt)}</td>
                        <td>{shortDateTime(b.expiresAt)}</td>
                        <td>
                          <span className={`status-badge ${b.status}`}>
                            {b.status === "expired"
                              ? "Нельзя продавать"
                              : b.status === "aging"
                                ? "Истекает"
                                : b.pastFreshness
                                  ? "После пика свежести"
                                  : "В продаже"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Списать"
                              disabled={!b.remaining}
                              onClick={() => setDiscardBatch(b)}
                            >
                              <Minus size={16} />
                            </button>
                            <button
                              title="Изменить"
                              onClick={() => openBatch(b)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              title="Удалить"
                              onClick={() => deleteBatch(b)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
function SalesPage({
  data,
  openSale,
  setData,
}: {
  data: Data;
  openSale: (s?: Sale) => void;
  setData: Dispatch<SetStateAction<Data>>;
}) {
  const [query, setQuery] = useState("");
  const sales = [...data.sales]
    .sort((a, b) => +new Date(b.soldAt) - +new Date(a.soldAt))
    .filter((s) =>
      data.products
        .find((p) => p.id === s.productId)
        ?.name.toLowerCase()
        .includes(query.toLowerCase()),
    );
  const deleteSale = (s: Sale) => {
    if (window.confirm("Удалить запись о продаже? Остаток будет пересчитан."))
      setData((d) => ({ ...d, sales: d.sales.filter((x) => x.id !== s.id) }));
  };
  return (
    <>
      <PageTitle
        eyebrow="ИСТОРИЯ"
        title="Продажи"
        description="Ручной журнал продаж для анализа спроса и расчёта остатков."
        action={
          <div className="title-actions">
            <PrimaryButton onClick={() => openSale()} className="compact">
              <Plus size={17} /> Добавить продажу
            </PrimaryButton>
          </div>
        }
      />
      {!data.sales.length ? (
        <SalesHistoryChart
          data={data}
          now={new Date()}
          onAddSale={() => openSale()}
        />
      ) : (
        <>
          <div className="metrics-grid sales-metrics">
            <Metric
              label="Всего записей"
              value={String(data.sales.length)}
              icon={<BarChart3 size={20} />}
              foot="Ручной журнал"
            />
            <Metric
              label="Продано сегодня"
              value={fmt(
                data.sales
                  .filter(
                    (s) => dateKey(new Date(s.soldAt)) === dateKey(new Date()),
                  )
                  .reduce((n, s) => n + s.quantity, 0),
              )}
              icon={<TrendingUp size={20} />}
              foot="Все продукты"
              tone="green"
            />
            <Metric
              label="Продано за всё время"
              value={fmt(data.sales.reduce((n, s) => n + s.quantity, 0))}
              icon={<Package size={20} />}
              foot="Все записи"
            />
          </div>
          <SalesHistoryChart data={data} now={new Date()} />
          <div className="panel table-panel">
            <div className="panel-head">
              <div>
                <span className="page-eyebrow">ЖУРНАЛ</span>
                <h2>Все продажи</h2>
              </div>
              <div className="search-box compact-search">
                <Search size={18} />
                <input
                  placeholder="Найти продукт"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ПРОДУКТ</th>
                    <th>КОЛИЧЕСТВО</th>
                    <th>ДАТА И ВРЕМЯ</th>
                    <th>ЦЕНА И СУММА</th>
                    <th>ИСТОЧНИК</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="table-product">
                          <ProductThumb
                            product={data.products.find(
                              (p) => p.id === s.productId,
                            )!}
                          />
                          <strong>
                            {data.products.find((p) => p.id === s.productId)
                              ?.name || "Продукт удалён"}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <strong>{fmt(s.quantity)}</strong>
                      </td>
                      <td>{shortDateTime(s.soldAt)}</td>
                      <td>
                        {s.lines?.length ? (
                          <div className="sale-lines">
                            {s.lines.map((line) => (
                              <span key={line.batchId}>
                                №{line.batchId.slice(0, 8)} ·{" "}
                                {fmt(line.quantity)} ×{" "}
                                {line.unitPrice === null
                                  ? "—"
                                  : rub(line.unitPrice)}
                                {line.discountPercent
                                  ? ` · скидка ${line.discountPercent}%`
                                  : ""}
                                {line.total !== null && ` = ${rub(line.total)}`}
                              </span>
                            ))}
                            <strong>
                              Итого:{" "}
                              {rub(
                                money(
                                  s.lines.reduce(
                                    (sum, line) => sum + (line.total || 0),
                                    0,
                                  ),
                                ),
                              )}
                            </strong>
                          </div>
                        ) : (
                          <span className="data-needed">Цена не записана</span>
                        )}
                      </td>
                      <td>
                        <span className="manual-badge">Вручную</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button title="Изменить" onClick={() => openSale(s)}>
                            <Pencil size={16} />
                          </button>
                          <button title="Удалить" onClick={() => deleteSale(s)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-foot">
              Продажи распределяются по доступным на момент продажи партиям:
              сначала самая ранняя партия с действующим сроком продажи. Цена
              новых записей сохраняется на момент продажи.
            </div>
          </div>
        </>
      )}
    </>
  );
}
function ChatPage() {
  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; text: string }[]
  >([]);
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);
  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: id(), role: "user", text },
      { id: id(), role: "assistant", text: "Чат временно недоступен." },
    ]);
    setDraft("");
  };
  return (
    <>
      <PageTitle
        eyebrow="ПОМОЩНИК"
        title="Чат"
        description="Напишите сообщение помощнику Economics."
      />
      <div className="chat-shell">
        <div className="chat-head">
          <span className="chat-avatar">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>Помощник Economics</strong>
            <small>Ваш диалог</small>
          </div>
        </div>
        <div
          className="chat-messages"
          ref={messagesRef}
          role="log"
          aria-label="История сообщений"
          aria-live="polite"
        >
          {!messages.length ? (
            <div className="chat-empty">
              <span>
                <MessageCircle size={31} />
              </span>
              <h3>Спросите о своём плане</h3>
              <p>Здесь появятся ваши сообщения.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div className={`message ${m.role}`} key={m.id}>
                <span className="message-author">
                  {m.role === "user" ? "Вы" : "Помощник Economics"}
                </span>
                <span>{m.text}</span>
              </div>
            ))
          )}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input
            type="text"
            aria-label="Сообщение"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Напишите сообщение..."
          />
          <button type="submit" aria-label="Отправить" disabled={!draft.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
}
function SettingsPage({
  data,
  setData,
  weather,
}: {
  data: Data;
  setData: Dispatch<SetStateAction<Data>>;
  weather: WeatherState;
}) {
  const [form, setForm] = useState(data.settings);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (form.close <= form.open) {
      setError("Закрытие должно быть позже открытия в тот же день.");
      return;
    }
    setError("");
    setData((d) => ({ ...d, settings: form }));
  };
  return (
    <>
      <PageTitle
        eyebrow="ПАРАМЕТРЫ"
        title="Настройки"
        description="Данные бизнеса и график работы для рекомендаций в течение дня."
      />
      <div className="settings-grid">
        <form className="panel settings-form" onSubmit={save}>
          <div className="panel-head">
            <div>
              <span className="page-eyebrow">ОСНОВНОЕ</span>
              <h2>Ваш бизнес</h2>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Название бизнеса
              <input
                value={form.businessName}
                onChange={(e) =>
                  setForm({ ...form, businessName: e.target.value })
                }
                placeholder="Название пекарни"
              />
            </label>
            <label>
              Город
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Москва"
              />
            </label>
            <label>
              Открытие
              <input
                type="time"
                required
                value={form.open}
                onChange={(e) => setForm({ ...form, open: e.target.value })}
              />
            </label>
            <label>
              Закрытие
              <input
                type="time"
                required
                value={form.close}
                onChange={(e) => setForm({ ...form, close: e.target.value })}
              />
            </label>
          </div>
          <p className="form-hint">
            Время работы влияет на оценку спроса до закрытия и возможность
            приготовить дополнительную партию. Укажите смену в пределах одного
            дня.
          </p>
          {error && <div className="form-error settings-error">{error}</div>}
          <PrimaryButton type="submit">
            Сохранить настройки <ArrowRight size={17} />
          </PrimaryButton>
        </form>
        <div className="settings-side">
          <div className="panel settings-info">
            <CloudSun size={23} />
            <h3>Погода</h3>
            <p>
              {weather.status === "ready"
                ? `${weather.message}. Прогноз используется для небольших корректировок спроса.`
                : weather.status === "loading"
                  ? "Загружаем данные о погоде."
                  : weather.status === "error"
                    ? `${weather.message}. Расчёт работает без погодного фактора.`
                    : "Укажите город, чтобы использовать погодный фактор."}
            </p>
          </div>
          <div className="panel settings-info">
            <CalendarDays size={23} />
            <h3>Праздники</h3>
            <p>
              Учитываются основные фиксированные праздничные даты России.
              Переносы выходных пока не учитываются.
            </p>
          </div>
          <div className="panel settings-info">
            <Clock3 size={23} />
            <h3>День недели</h3>
            <p>
              Сегодня:{" "}
              {currentDate.toLocaleDateString("ru-RU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              <br />
              День недели учитывается при сравнении с прошлыми продажами.
            </p>
          </div>
          <div className="panel settings-info">
            <MapPin size={23} />
            <h3>Мероприятия в городе</h3>
          </div>
          <div className="panel settings-info expiration-factor">
            <Clock3 size={23} />
            <h3>Приближение срока годности</h3>
            <p>
              Рекомендация по скидке зависит от оставшегося срока продажи каждой
              партии: до 4 часов — 10%, до 2 часов — 20%, до 1 часа — 30%.
              Предупреждение появляется в последние 25% срока, не раньше чем за
              4 часа. Цена автоматически не меняется.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Закрыть">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
async function imageFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 500 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      if (!ctx) {
        reject(new Error("Ошибка обработки изображения"));
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.68));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}
function ProductDialog({
  data,
  product,
  onClose,
  onSave,
}: {
  data: Data;
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [form, setForm] = useState<Product>(
    product || {
      id: id(),
      name: "",
      description: "",
      image: "",
      weight: 100,
      prepMinutes: 30,
      freshnessHours: 8,
      shelfHours: 24,
      price: undefined,
    },
  );
  const [error, setError] = useState("");
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const image = await imageFromFile(file);
      setForm((f) => ({ ...f, image }));
      setError("");
    } catch {
      setError("Не удалось загрузить изображение");
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (
      form.price !== undefined &&
      (!Number.isFinite(form.price) || form.price < 0)
    ) {
      setError("Цена должна быть неотрицательным числом.");
      return;
    }
    if (form.freshnessHours > form.shelfHours) {
      setError(
        "Время оптимальной свежести не может быть дольше срока продажи.",
      );
      return;
    }
    const updated = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    };
    if (
      product &&
      !salesFitBatches({
        ...data,
        products: data.products.map((p) => (p.id === updated.id ? updated : p)),
      })
    ) {
      setError("Новый срок продажи противоречит записанным продажам.");
      return;
    }
    onSave(updated);
  };
  return (
    <Modal
      title={product ? "Редактировать продукт" : "Новый продукт"}
      subtitle="Основные свойства для учёта партий и рекомендаций"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="image-upload">
          <label className="upload-area">
            {form.image ? (
              <img src={form.image} alt="Предпросмотр" />
            ) : (
              <Upload size={24} />
            )}
            <span>{form.image ? "Изменить фото" : "Добавить фото"}</span>
            <input type="file" accept="image/*" onChange={upload} />
          </label>
          <p>Фото продукта</p>
        </div>
        <label>
          Название продукта
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Например, Круассан классический"
          />
        </label>
        <label>
          Описание
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Короткое описание для команды"
          />
        </label>
        <div className="field-grid">
          <label>
            Цена за штуку, ₽
            <input
              type="number"
              min="0"
              step="0.01"
              required={!product}
              value={form.price ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  price:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Укажите цену"
            />
          </label>
          <label>
            Вес, г
            <input
              type="number"
              required
              min="1"
              value={form.weight}
              onChange={(e) =>
                setForm({ ...form, weight: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Приготовление, мин
            <input
              type="number"
              required
              min="1"
              value={form.prepMinutes}
              onChange={(e) =>
                setForm({ ...form, prepMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Свежесть, ч
            <input
              type="number"
              required
              min="1"
              value={form.freshnessHours}
              onChange={(e) =>
                setForm({ ...form, freshnessHours: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Можно продавать, ч
            <input
              type="number"
              required
              min="1"
              value={form.shelfHours}
              onChange={(e) =>
                setForm({ ...form, shelfHours: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <p className="form-hint">
          Свежесть — период лучшего качества. Срок продажи — момент, после
          которого продукт нельзя продавать.
        </p>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <PrimaryButton type="submit">
            {product ? "Сохранить" : "Добавить продукт"}{" "}
            <ArrowRight size={17} />
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
function BatchDialog({
  data,
  batch,
  onClose,
  onSave,
}: {
  data: Data;
  batch: Batch | null;
  onClose: () => void;
  onSave: (b: Batch) => void;
}) {
  const [form, setForm] = useState<Batch>(
    batch || {
      id: id(),
      productId: data.products[0]?.id || "",
      quantity: 1,
      preparedAt: timeInput(new Date()),
      discarded: 0,
    },
  );
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.productId) {
      setError("Сначала добавьте продукт.");
      return;
    }
    if (+new Date(form.preparedAt) > Date.now()) {
      setError("Время выпуска не может быть в будущем.");
      return;
    }
    if (form.quantity < form.discarded) {
      setError("Количество меньше уже списанного.");
      return;
    }
    const next = {
      ...data,
      batches: batch
        ? data.batches.map((b) => (b.id === form.id ? form : b))
        : [...data.batches, form],
    };
    if (!salesFitBatches(next)) {
      setError("Изменение партии противоречит записанным продажам.");
      return;
    }
    onSave(form);
  };
  return (
    <Modal
      title={batch ? "Редактировать партию" : "Новая партия"}
      subtitle="Запишите, что и когда было приготовлено"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {!data.products.length ? (
          <div className="form-error">Сначала добавьте продукт в каталог.</div>
        ) : (
          <>
            <label>
              Продукт
              <select
                required
                value={form.productId}
                onChange={(e) =>
                  setForm({ ...form, productId: e.target.value })
                }
              >
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              <label>
                Количество, шт.
                <input
                  type="number"
                  min={Math.max(1, form.discarded)}
                  required
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Время готовности
                <input
                  type="datetime-local"
                  required
                  value={form.preparedAt}
                  onChange={(e) =>
                    setForm({ ...form, preparedAt: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="form-hint">
              Срок продажи рассчитывается по времени готовности и свойствам
              продукта.
            </p>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Отмена
              </button>
              <PrimaryButton type="submit">
                Сохранить партию <ArrowRight size={17} />
              </PrimaryButton>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
function SaleDialog({
  data,
  sale,
  onClose,
  onSave,
}: {
  data: Data;
  sale: Sale | null;
  onClose: () => void;
  onSave: (s: Sale) => void;
}) {
  const [form, setForm] = useState<Sale>(
    sale || {
      id: id(),
      productId: data.products[0]?.id || "",
      quantity: 1,
      soldAt: timeInput(new Date()),
    },
  );
  const [error, setError] = useState("");
  const [pastPrices, setPastPrices] = useState<
    Record<string, { regular: string; unit: string }>
  >({});
  const legacyEdit = !!sale && !sale.lines?.length;
  const changedSale =
    !sale ||
    form.productId !== sale.productId ||
    form.quantity !== sale.quantity ||
    form.soldAt !== sale.soldAt;
  const pastSale =
    changedSale && Date.now() - +new Date(form.soldAt) > 5 * 60000;
  const allocation = legacyEdit
    ? null
    : saleLinesFor(
        data,
        form.productId,
        form.quantity,
        form.soldAt,
        sale?.id,
        sale && form.productId === sale.productId && form.soldAt === sale.soldAt
          ? sale.lines
          : [],
      );
  const preview = allocation?.map((line) => {
    if (!pastSale) return line;
    const entered = pastPrices[line.batchId];
    const regular = Number(entered?.regular);
    const unit = Number(entered?.unit);
    if (
      !entered ||
      entered.regular === "" ||
      entered.unit === "" ||
      !Number.isFinite(regular) ||
      !Number.isFinite(unit) ||
      regular < 0 ||
      unit < 0
    )
      return {
        ...line,
        regularPrice: null,
        discountPercent: null,
        unitPrice: null,
        total: null,
      };
    return {
      ...line,
      regularPrice: money(regular),
      discountPercent:
        regular > 0 && unit < regular
          ? Math.round((1 - unit / regular) * 10000) / 100
          : null,
      unitPrice: money(unit),
      total: money(line.quantity * unit),
    };
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.productId) {
      setError("Сначала добавьте продукт.");
      return;
    }
    const at = new Date(form.soldAt);
    if (+at > Date.now()) {
      setError("Дата продажи не может быть в будущем.");
      return;
    }
    const checkData = {
      ...data,
      sales: data.sales.filter(
        (s) => s.id !== form.id && +new Date(s.soldAt) <= +at,
      ),
    };
    const possible = availableFor(checkData, form.productId, at);
    if (form.quantity > possible) {
      setError(
        `На этот момент доступно только ${fmt(possible)}. Запишите партию или уменьшите количество.`,
      );
      return;
    }
    if (!legacyEdit && !preview) {
      setError(
        "Укажите обычную цену в карточке продукта и проверьте доступные партии.",
      );
      return;
    }
    if (pastSale && preview?.some((line) => line.unitPrice === null)) {
      setError(
        "Укажите обычную и фактическую цену для каждой партии на момент продажи.",
      );
      return;
    }
    const saved = {
      ...form,
      lines: legacyEdit ? undefined : preview || undefined,
    };
    const next = {
      ...data,
      sales: sale
        ? data.sales.map((s) => (s.id === form.id ? saved : s))
        : [...data.sales, saved],
    };
    if (!salesFitBatches(next)) {
      setError(
        "После этой записи некоторые продажи останутся без доступной партии.",
      );
      return;
    }
    onSave(saved);
  };
  return (
    <Modal
      title={sale ? "Редактировать продажу" : "Добавить продажу"}
      subtitle="Продажа уменьшит доступный остаток"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {!data.products.length ? (
          <div className="form-error">Сначала добавьте продукт и партию.</div>
        ) : (
          <>
            <label>
              Продукт
              <select
                value={form.productId}
                onChange={(e) =>
                  setForm({ ...form, productId: e.target.value })
                }
              >
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              <label>
                Количество, шт.
                <input
                  type="number"
                  min="1"
                  required
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Дата и время
                <input
                  type="datetime-local"
                  required
                  value={form.soldAt}
                  onChange={(e) => setForm({ ...form, soldAt: e.target.value })}
                />
              </label>
            </div>
            <p className="form-hint">
              Продажа будет вычтена из самой ранней подходящей партии с
              действующим сроком продажи.
            </p>
            {legacyEdit ? (
              <p className="form-hint">
                В этой ранее записанной продаже цена не указана; при
                редактировании она останется без цены.
              </p>
            ) : preview ? (
              <div className="sale-preview">
                <strong>
                  {pastSale ? "Цены на момент продажи" : "Цена этой продажи"}
                </strong>
                {pastSale && (
                  <p className="form-hint">
                    Продажа записывается задним числом. Укажите фактические цены
                    каждой партии: текущая цена могла тогда отличаться.
                  </p>
                )}
                {preview.map((line) => (
                  <div key={line.batchId} className="sale-preview-line">
                    {pastSale && (
                      <div className="field-grid">
                        <label>
                          Обычная цена партии №{line.batchId.slice(0, 8)}, ₽
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={pastPrices[line.batchId]?.regular ?? ""}
                            onChange={(e) =>
                              setPastPrices({
                                ...pastPrices,
                                [line.batchId]: {
                                  regular: e.target.value,
                                  unit: pastPrices[line.batchId]?.unit ?? "",
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Фактическая цена за штуку, ₽
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={pastPrices[line.batchId]?.unit ?? ""}
                            onChange={(e) =>
                              setPastPrices({
                                ...pastPrices,
                                [line.batchId]: {
                                  regular:
                                    pastPrices[line.batchId]?.regular ?? "",
                                  unit: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                    <span>
                      Партия №{line.batchId.slice(0, 8)}: {fmt(line.quantity)} ×{" "}
                      {line.unitPrice === null ? "—" : rub(line.unitPrice)}
                      {line.discountPercent
                        ? ` (−${line.discountPercent}%)`
                        : ""}{" "}
                      = {line.total === null ? "—" : rub(line.total)}
                    </span>
                  </div>
                ))}
                {preview.every((line) => line.total !== null) && (
                  <b>
                    {rub(
                      money(
                        preview.reduce(
                          (sum, line) => sum + (line.total || 0),
                          0,
                        ),
                      ),
                    )}
                  </b>
                )}
              </div>
            ) : null}
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Отмена
              </button>
              <PrimaryButton type="submit">
                Сохранить продажу <ArrowRight size={17} />
              </PrimaryButton>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
function DiscardDialog({
  batch,
  product,
  maximum,
  onClose,
  onSave,
}: {
  batch: Batch;
  product?: Product;
  maximum: number;
  onClose: () => void;
  onSave: (qty: number) => void;
}) {
  const [qty, setQty] = useState(maximum);
  return (
    <Modal
      title="Списать продукцию"
      subtitle={`${product?.name || "Продукт"} · партия от ${shortDateTime(batch.preparedAt)}`}
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (qty >= 1 && qty <= maximum) onSave(qty);
        }}
      >
        <p className="form-hint">
          Списанные единицы больше не входят в доступный остаток. Доступно для
          списания: {fmt(maximum)}.
        </p>
        <label>
          Количество, шт.
          <input
            type="number"
            min="1"
            max={maximum}
            required
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Отмена
          </button>
          <PrimaryButton type="submit">
            Списать <ArrowRight size={17} />
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
function Root() {
  const { data, setData } = useData();
  const weather = useWeather(data.settings.city);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register setData={setData} />} />
        <Route
          path="/app/*"
          element={<AppShell {...{ data, setData, weather }} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default Root;
