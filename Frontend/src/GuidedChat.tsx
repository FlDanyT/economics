import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Package, Search, Sparkles } from "lucide-react";
import { businessClock, type Data } from "./model.ts";
import {
  buildAssistantAnswer, needsProduct, periodLabels, productQuestions,
  questionLabels, questionOptions, topicOptions,
  type AssistantAnswer, type AssistantPeriod, type AssistantQuestion,
  type AssistantTopic, type AssistantWeather,
} from "./assistantAnswers.ts";

type Choice = { view: "topics" | "questions" | "products" | "productMenu" | "followUps"; topic: AssistantTopic | null; pending: AssistantQuestion | null };
type Message = {
  id: number;
  role: "user" | "assistant";
  text?: string;
  answer?: AssistantAnswer;
  question?: AssistantQuestion;
  productId?: string | null;
  period?: AssistantPeriod;
  timestamp?: string;
};
const initialChoice: Choice = { view: "topics", topic: null, pending: null };
const productLabel: Partial<Record<AssistantQuestion, string>> = {
  todayDecision: "Нужно ли допечь сегодня?",
  tomorrowProduct: "Сколько приготовить завтра утром?",
  salesProduct: "Как он продавался?",
  todayWhy: "Почему такая рекомендация?",
};

export function GuidedChat({ data, weather, now }: { data: Data; weather: AssistantWeather; now: Date }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const [choiceHistory, setChoiceHistory] = useState<Choice[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<AssistantPeriod>("7d");
  const [deletedProduct, setDeletedProduct] = useState(false);
  const nextId = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const selectedProduct = data.products.find((product) => product.id === selectedProductId);
  const lastAnswer = [...messages].reverse().find((message) => message.role === "assistant" && message.answer);

  useEffect(() => {
    if (selectedProductId && !data.products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(null);
      setDeletedProduct(true);
      setChoice({ view: "products", topic: null, pending: null });
      setChoiceHistory([]);
    }
  }, [data.products, selectedProductId]);
  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, choice]);

  const navigateChoice = (next: Choice) => {
    setChoiceHistory((history) => [...history, choice]);
    setChoice(next);
  };
  const allQuestions = () => {
    setChoice(initialChoice);
    setChoiceHistory([]);
  };
  const back = () => {
    const previous = choiceHistory.at(-1);
    if (previous) {
      setChoice(previous);
      setChoiceHistory((history) => history.slice(0, -1));
    } else allQuestions();
  };
  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setDeletedProduct(false);
    setSearch("");
    if (choice.pending) {
      const pending = choice.pending;
      ask(pending, productId);
    } else navigateChoice({ view: "productMenu", topic: choice.topic, pending: null });
  };
  const ask = (question: AssistantQuestion, productId = selectedProductId, answerPeriod = period) => {
    if (needsProduct(question) && !productId) {
      setSearch("");
      navigateChoice({ view: "products", topic: choice.topic, pending: question });
      return;
    }
    const answer = buildAssistantAnswer({ data, now, weather }, question, productId, answerPeriod);
    const clock = businessClock(now, weather.timeZone);
    const timestamp = `${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
    setMessages((current) => [
      ...current,
      { id: ++nextId.current, role: "user", text: questionLabels[question] },
      { id: ++nextId.current, role: "assistant", answer, question, productId, period: answerPeriod, timestamp },
    ]);
    navigateChoice({ view: "followUps", topic: choice.topic, pending: null });
  };
  const changePeriod = (newPeriod: AssistantPeriod, message: Message) => {
    if (!message.question) return;
    setPeriod(newPeriod);
    const answer = buildAssistantAnswer({ data, now, weather }, message.question, message.productId, newPeriod);
    const clock = businessClock(now, weather.timeZone);
    const timestamp = `${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, answer, period: newPeriod, timestamp } : item));
  };
  const productMatches = data.products.filter((product) => product.name.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
  const options = choice.view === "questions" && choice.topic ? questionOptions[choice.topic] :
    choice.view === "productMenu" ? productQuestions :
      choice.view === "followUps" ? lastAnswer?.answer?.followUps || [] : [];

  return (
    <>
      <div className="page-title">
        <div>
          <span className="page-eyebrow">ПОМОЩНИК</span>
          <h1>Чат</h1>
          <p>Выберите вопрос — помощник ответит по текущим данным бизнеса.</p>
        </div>
      </div>
      <section className="chat-shell guided-chat" aria-label="Помощник Economics">
        <div className="chat-head">
          <span className="chat-avatar"><Sparkles size={20} /></span>
          <div><strong>Помощник Economics</strong><small>Ответы по вашим данным</small></div>
          <button type="button" className="chat-product-shortcut" onClick={() => { setSearch(""); navigateChoice({ view: "products", topic: choice.topic, pending: null }); }}>
            <Package size={16} /> {selectedProduct ? "Другой товар" : "Выбрать товар"}
          </button>
        </div>
        <div className="chat-messages" ref={messagesRef} role="log" aria-label="История сообщений" aria-live="polite">
          <div className="message assistant chat-welcome">
            <span className="message-author">Помощник Economics</span>
            <strong>С чем помочь?</strong>
            <span>Выберите вопрос — я покажу ответ по вашим текущим данным.</span>
          </div>
          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              <span className="message-author">{message.role === "user" ? "Вы" : "Помощник Economics"}</span>
              {message.text && <span>{message.text}</span>}
              {message.answer && <>
                <strong className="chat-answer-title">{message.answer.title}</strong>
                <p className="chat-answer-summary">{message.answer.summary}</p>
                {message.answer.details?.map((detail, index) => <p className="chat-answer-detail" key={index}>{detail}</p>)}
                {!!message.answer.rows?.length && <div className="chat-answer-rows">
                  {message.answer.rows.map((row, index) => <div className="chat-answer-row" key={`${row.label}-${index}`}>
                    <div><strong>{row.label}</strong>{row.detail && <small>{row.detail}</small>}</div><b>{row.value}</b>
                  </div>)}
                </div>}
                {!!message.answer.links?.length && <div className="chat-answer-links">
                  {message.answer.links.map((link) => <Link key={`${link.to}-${link.label}`} to={link.to}>{link.label}<ArrowRight size={14} /></Link>)}
                </div>}
                {message.question && ["salesTop", "salesProduct", "salePrices"].includes(message.question) && <div className="chat-periods" aria-label="Период продаж">
                  {(Object.keys(periodLabels) as AssistantPeriod[]).map((value) => <button type="button" key={value} className={message.period === value ? "active" : ""} aria-pressed={message.period === value} onClick={() => changePeriod(value, message)}>{periodLabels[value]}</button>)}
                </div>}
                <small className="chat-answer-time">По данным на {message.timestamp}</small>
                {message.id === lastAnswer?.id && !deletedProduct && (!message.productId || data.products.some((product) => product.id === message.productId)) && !!message.answer.followUps?.length && <div className="chat-inline-actions" aria-label="Продолжить разговор">
                  {message.answer.followUps.slice(0, 3).map((question) => <button type="button" key={question} onClick={() => ask(question, message.productId ?? selectedProductId)}>{questionLabels[question]}</button>)}
                </div>}
              </>}
            </div>
          ))}
        </div>
        <div className="chat-choice-panel">
          <div className="chat-choice-top">
            <div>
              <span className="page-eyebrow">ВЫБОР ВОПРОСА</span>
              <strong>{choice.view === "topics" ? "Что вас интересует?" : choice.view === "questions" ? topicOptions.find((topic) => topic.id === choice.topic)?.label : choice.view === "products" ? "Выберите товар" : choice.view === "productMenu" ? `${selectedProduct?.name || "Товар"}: вопросы` : "Что ещё показать?"}</strong>
            </div>
            <div className="chat-nav-actions">
              {choice.view !== "topics" && <button type="button" onClick={back}><ArrowLeft size={14} /> Назад</button>}
              <button type="button" onClick={allQuestions}>Все вопросы</button>
            </div>
          </div>
          {deletedProduct && <p className="chat-context-note" role="status">Выбранный товар был удалён. Выберите другой товар.</p>}
          {choice.view === "topics" && <div className="chat-topic-grid">
            {topicOptions.map((topic) => <button type="button" key={topic.id} onClick={() => navigateChoice({ view: "questions", topic: topic.id, pending: null })}>
              <strong>{topic.label}</strong><small>{topic.description}</small><ArrowRight size={16} />
            </button>)}
          </div>}
          {choice.view === "products" && <>
            <label className="chat-product-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товар" aria-label="Найти товар" /></label>
            {!data.products.length ? <div className="chat-selector-empty">Товаров пока нет. <Link to="/app/products">Открыть продукты</Link></div> :
              !productMatches.length ? <p className="chat-selector-empty">По запросу товары не найдены.</p> :
                <div className="chat-product-list">{productMatches.map((product) => <button type="button" key={product.id} onClick={() => selectProduct(product.id)}>{product.name}<ArrowRight size={15} /></button>)}</div>}
          </>}
          {!!options.length && <div className="chat-question-list">{options.map((question) => <button type="button" key={question} onClick={() => ask(question, choice.view === "questions" && question === "todayDecision" ? null : selectedProductId)}>
            {choice.view === "productMenu" ? productLabel[question] || questionLabels[question] : questionLabels[question]}<ArrowRight size={15} />
          </button>)}</div>}
          {choice.view === "productMenu" && <button type="button" className="chat-other-product" onClick={() => { setSearch(""); navigateChoice({ view: "products", topic: choice.topic, pending: null }); }}>Другой товар</button>}
        </div>
      </section>
    </>
  );
}
