"use client";

import React, { useMemo, useState } from "react";
import CursorController, { type GuideOptions } from "./CursorController";

export async function guideCursorTo(id: string, options: GuideOptions = {}) {
  if (typeof window !== "undefined" && (window as any).__cursorGuide) {
    return (window as any).__cursorGuide(id, options);
  }
  console.warn("[guideCursorTo] CursorController is not mounted yet");
}

// Expose globally for easy manual triggering in console if needed
if (typeof window !== "undefined") {
  // @ts-ignore
  (window as any).guideCursorTo = guideCursorTo;
}


export default function DemoPage() {
  const [rangeValue, setRangeValue] = useState(20);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("us");
  // Complex page state
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("CA");
  const [zip, setZip] = useState("");
  const [prefDarkMode, setPrefDarkMode] = useState(false);
  const [prefEmailMe, setPrefEmailMe] = useState(true);
  const [timezone, setTimezone] = useState("UTC");
  const [activeTab, setActiveTab] = useState<"users" | "settings" | "stats">("users");
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [accOpen, setAccOpen] = useState<{[k: number]: boolean}>({ 1: true, 2: false, 3: false });
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "role" | "score">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rows, setRows] = useState<Array<{ id: number; name: string; role: string; score: number }>>([
    { id: 1, name: "Alice", role: "Admin", score: 92 },
    { id: 2, name: "Bob", role: "User", score: 67 },
    { id: 3, name: "Charlie", role: "User", score: 78 },
    { id: 4, name: "Dana", role: "Manager", score: 85 },
  ]);
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const n = sortKey === "score" ? a.score - b.score : String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === "asc" ? n : -n;
    });
    return copy;
  }, [rows, sortKey, sortDir]);
  const [backlog, setBacklog] = useState<Array<{ id: string; title: string }>>([
    { id: "b1", title: "Integrate payments" },
    { id: "b2", title: "Add audit logs" },
    { id: "b3", title: "Write docs" },
  ]);
  const [doing, setDoing] = useState<Array<{ id: string; title: string }>>([
    { id: "d1", title: "Fix login bug" },
  ]);

  // Handlers
  function toggleSort(key: "name" | "role" | "score") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startProgress() {
    setProgress(0);
    const total = 100;
    const step = 5;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const np = Math.min(total, p + step);
        if (np >= total) window.clearInterval(id);
        return np;
      });
    }, 120);
  }

  async function demoOpenModalAndConfirm() {
    await guideCursorTo("openModalBtn", { action: "click", durationMs: 700 });
    await new Promise((r) => setTimeout(r, 250));
    await guideCursorTo("confirmModalBtn", { action: "click", durationMs: 700 });
  }

  async function demoSwitchToStatsAndStartProgress() {
    await guideCursorTo("tabStats", { action: "click", durationMs: 700 });
    await new Promise((r) => setTimeout(r, 150));
    await guideCursorTo("progressStartBtn", { action: "click", durationMs: 700 });
  }

  async function demoSortByScore() {
    await guideCursorTo("sortScore", { action: "click" });
  }

  async function demoExpandAccordion2() {
    await guideCursorTo("accItem2Btn", { action: "click" });
  }

  async function demoMoveFirstCardToDoing() {
    if (backlog.length === 0) return;
    await guideCursorTo("cardBacklog0", { action: "drag", toElementId: "doingDrop", durationMs: 700 });
    // Simulate move after drag
    setBacklog((b) => {
      const first = b[0];
      setDoing((d) => [first, ...d]);
      return b.slice(1);
    });
  }

  return (
    <main className="min-h-dvh p-6 md:p-10 max-w-4xl mx-auto">
      <CursorController />
      <h1 className="text-2xl font-semibold mb-4">Interactive Demo</h1>
      <p className="text-sm opacity-80 mb-6">
        This page includes various inputs and a programmable fake cursor. Use the
        demo buttons to see it move, click, and drag. Try the route at <code>/demo</code>.
      </p>

      <section className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label htmlFor="nameInput" className="block text-sm mb-1">
              Name
            </label>
            <input
              id="nameInput"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="emailInput" className="block text-sm mb-1">
              Email
            </label>
            <input
              id="emailInput"
              type="email"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="passwordInput" className="block text-sm mb-1">
              Password
            </label>
            <input
              id="passwordInput"
              type="password"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="bioInput" className="block text-sm mb-1">
              Bio
            </label>
            <textarea
              id="bioInput"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Short description..."
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2">
              <input id="newsletterCheck" type="checkbox" className="size-4" />
              <span className="text-sm">Subscribe</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input id="agreeCheck" type="checkbox" className="size-4" />
              <span className="text-sm">Agree to terms</span>
            </label>
          </div>

          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="role" id="roleUser" className="size-4" defaultChecked />
              <span className="text-sm">User</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="role" id="roleAdmin" className="size-4" />
              <span className="text-sm">Admin</span>
            </label>
          </div>

          <div>
            <label htmlFor="countrySelect" className="block text-sm mb-1">
              Country
            </label>
            <select
              id="countrySelect"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
              <option value="sa">Saudi Arabia</option>
              <option value="de">Germany</option>
            </select>
          </div>

          <div>
            <label htmlFor="volumeSlider" className="block text-sm mb-1">
              Volume: <span className="font-mono">{Math.round(rangeValue)}</span>
            </label>
            <input
              id="volumeSlider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={rangeValue}
              onChange={(e) => setRangeValue(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <button
              id="submitBtn"
              className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 active:scale-[0.99]"
              onClick={() => alert(`Submitted: ${name || "(no name)"}, ${email || "(no email)"}`)}
            >
              Submit
            </button>
            <button
              id="resetBtn"
              className="rounded-md bg-neutral-200 text-neutral-900 px-4 py-2 hover:bg-neutral-300 active:scale-[0.99]"
              onClick={() => {
                setName("");
                setEmail("");
                setCountry("us");
                setRangeValue(20);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">Cursor Demos</h2>
          <p className="text-sm opacity-80">Click a demo to watch the cursor move and act.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("nameInput", { action: "click" })}
            >
              Focus Name (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("emailInput", { action: "click" })}
            >
              Focus Email (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("countrySelect", { action: "click" })}
            >
              Open Country Select (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("submitBtn", { action: "click" })}
            >
              Click Submit
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("volumeSlider", { action: "drag", toValue: 80 })}
            >
              Drag Volume to 80
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("volumeSlider", { action: "drag", toValue: 10 })}
            >
              Drag Volume to 10
            </button>
          </div>
          <p className="text-xs opacity-70">
            You can also call <code>window.guideCursorTo(id, options)</code> from the browser console.
          </p>
        </div>
      </section>
      {/* Complex Form */}
      <section className="mt-10 grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <h2 className="font-medium">Complex Form</h2>
          <div className="rounded-lg border p-4 space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Account</legend>
              <div>
                <label htmlFor="usernameInput" className="block text-sm mb-1">Username</label>
                <input id="usernameInput" className="w-full rounded-md border px-3 py-2" value={username} onChange={(e)=>setUsername(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="passwordInput2" className="block text-sm mb-1">Password</label>
                  <input id="passwordInput2" type="password" className="w-full rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm mb-1">Confirm</label>
                  <input id="confirmPassword" type="password" className="w-full rounded-md border px-3 py-2" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="dobInput" className="block text-sm mb-1">Date of Birth</label>
                  <input id="dobInput" type="date" className="w-full rounded-md border px-3 py-2" value={dob} onChange={(e)=>setDob(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="phoneInput2" className="block text-sm mb-1">Phone</label>
                  <input id="phoneInput2" className="w-full rounded-md border px-3 py-2" placeholder="+1 555 0123" value={phone} onChange={(e)=>setPhone(e.target.value)} />
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Address</legend>
              <div>
                <label htmlFor="addr1" className="block text-sm mb-1">Address line 1</label>
                <input id="addr1" className="w-full rounded-md border px-3 py-2" value={address1} onChange={(e)=>setAddress1(e.target.value)} />
              </div>
              <div>
                <label htmlFor="addr2" className="block text-sm mb-1">Address line 2</label>
                <input id="addr2" className="w-full rounded-md border px-3 py-2" value={address2} onChange={(e)=>setAddress2(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cityInput" className="block text-sm mb-1">City</label>
                  <input id="cityInput" className="w-full rounded-md border px-3 py-2" value={city} onChange={(e)=>setCity(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="stateSelect" className="block text-sm mb-1">State</label>
                  <select id="stateSelect" className="w-full rounded-md border px-3 py-2" value={stateCode} onChange={(e)=>setStateCode(e.target.value)}>
                    <option value="CA">CA</option>
                    <option value="NY">NY</option>
                    <option value="TX">TX</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="zipInput" className="block text-sm mb-1">ZIP</label>
                <input id="zipInput" className="w-full rounded-md border px-3 py-2" value={zip} onChange={(e)=>setZip(e.target.value)} />
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Preferences</legend>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input id="prefDark" type="checkbox" className="size-4" checked={prefDarkMode} onChange={(e)=>setPrefDarkMode(e.target.checked)} />
                  <span className="text-sm">Dark mode</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input id="prefEmail" type="checkbox" className="size-4" checked={prefEmailMe} onChange={(e)=>setPrefEmailMe(e.target.checked)} />
                  <span className="text-sm">Email me updates</span>
                </label>
              </div>
              <div>
                <label htmlFor="timezoneSelect" className="block text-sm mb-1">Timezone</label>
                <select id="timezoneSelect" className="w-full rounded-md border px-3 py-2" value={timezone} onChange={(e)=>setTimezone(e.target.value)}>
                  <option>UTC</option>
                  <option>PST</option>
                  <option>EST</option>
                  <option>CET</option>
                </select>
              </div>
              <div>
                <label htmlFor="fileInput" className="block text-sm mb-1">Upload avatar</label>
                <input id="fileInput" type="file" className="w-full rounded-md border px-3 py-2 bg-white" onChange={(e)=>setFileObj(e.target.files?.[0] ?? null)} />
                <p className="text-xs opacity-70 mt-1">{fileObj ? `Selected: ${fileObj.name}` : "No file selected"}</p>
              </div>
            </fieldset>
            <div className="flex gap-3">
              <button id="saveProfileBtn" className="rounded-md bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700">Save Profile</button>
              <button id="resetProfileBtn" className="rounded-md border px-4 py-2" onClick={()=>{
                setUsername(""); setConfirmPassword(""); setDob(""); setPhone(""); setAddress1(""); setAddress2(""); setCity(""); setStateCode("CA"); setZip(""); setPrefDarkMode(false); setPrefEmailMe(true); setTimezone("UTC"); setFileObj(null);
              }}>Reset</button>
            </div>
          </div>
        </div>

        {/* Components */}
        <div className="space-y-6">
          <h2 className="font-medium">Components</h2>
          {/* Tabs */}
          <div className="rounded-lg border">
            <div className="flex border-b">
              <button id="tabUsers" className={`px-4 py-2 text-sm ${activeTab==='users' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} onClick={()=>setActiveTab('users')}>Users</button>
              <button id="tabSettings" className={`px-4 py-2 text-sm ${activeTab==='settings' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} onClick={()=>setActiveTab('settings')}>Settings</button>
              <button id="tabStats" className={`px-4 py-2 text-sm ${activeTab==='stats' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} onClick={()=>setActiveTab('stats')}>Stats</button>
            </div>
            <div className="p-4">
              {activeTab === 'users' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th><button id="sortName" className="px-2 py-1 rounded hover:bg-neutral-100" onClick={()=>toggleSort('name')}>Name</button></th>
                          <th><button id="sortRole" className="px-2 py-1 rounded hover:bg-neutral-100" onClick={()=>toggleSort('role')}>Role</button></th>
                          <th><button id="sortScore" className="px-2 py-1 rounded hover:bg-neutral-100" onClick={()=>toggleSort('score')}>Score</button></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map((r)=> (
                          <tr key={r.id} className="border-t hover:bg-neutral-50">
                            <td className="px-2 py-2">{r.name}</td>
                            <td className="px-2 py-2">{r.role}</td>
                            <td className="px-2 py-2">{r.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button id="addRowBtn" className="rounded-md border px-3 py-2" onClick={()=> setRows((rs)=> [...rs, { id: Date.now(), name: `User ${rs.length+1}`, role: 'User', score: Math.floor(Math.random()*100)}])}>Add Row</button>
                </div>
              )}
              {activeTab === 'settings' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" className="size-4" checked={prefDarkMode} onChange={(e)=>setPrefDarkMode(e.target.checked)} />
                      <span className="text-sm">Enable dark mode</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" className="size-4" checked={prefEmailMe} onChange={(e)=>setPrefEmailMe(e.target.checked)} />
                      <span className="text-sm">Email me tips</span>
                    </label>
                  </div>
                  <button id="openModalBtn" className="rounded-md bg-blue-600 text-white px-3 py-2" onClick={()=> setModalOpen(true)}>Open Modal</button>
                </div>
              )}
              {activeTab === 'stats' && (
                <div className="space-y-3">
                  <div>
                    <div aria-label="progress" id="progressBar" className="h-2 bg-neutral-200 rounded">
                      <div className="h-2 bg-green-600 rounded" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs mt-1">{progress}%</p>
                  </div>
                  <button id="progressStartBtn" className="rounded-md border px-3 py-2" onClick={startProgress}>Start</button>
                </div>
              )}
            </div>
          </div>

          {/* Accordion */}
          <div className="rounded-lg border divide-y">
            {[1,2,3].map((i)=> (
              <div key={i}>
                <button id={`accItem${i}Btn`} className="w-full text-left px-4 py-3 hover:bg-neutral-50" onClick={()=> setAccOpen((o)=> ({...o, [i]: !o[i]}))}>
                  <span className="font-medium">Section {i}</span>
                </button>
                {accOpen[i] && (
                  <div className="px-4 pb-4 text-sm opacity-80">This is the content of accordion item {i}.</div>
                )}
              </div>
            ))}
          </div>

          {/* Kanban-like Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <h3 className="font-medium mb-2">Backlog</h3>
              <div className="space-y-2">
                {backlog.map((c, idx)=> (
                  <div id={`cardBacklog${idx}`} key={c.id} className="rounded border bg-white px-3 py-2 shadow-sm">
                    {c.title}
                  </div>
                ))}
              </div>
            </div>
            <div id="doingDrop" className="rounded-lg border p-3">
              <h3 className="font-medium mb-2">Doing</h3>
              <div className="space-y-2">
                {doing.map((c)=> (
                  <div key={c.id} className="rounded border bg-white px-3 py-2 shadow-sm">{c.title}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40">
          <div className="bg-white text-neutral-900 rounded-lg shadow-lg w-[min(92vw,480px)] p-4">
            <h3 className="font-medium mb-2">Confirm Action</h3>
            <p className="text-sm opacity-80 mb-4">Are you sure you want to proceed?</p>
            <div className="flex justify-end gap-2">
              <button id="cancelModalBtn" className="rounded-md border px-3 py-2" onClick={()=> setModalOpen(false)}>Cancel</button>
              <button id="confirmModalBtn" className="rounded-md bg-blue-600 text-white px-3 py-2" onClick={()=> setModalOpen(false)}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* More Cursor Demos */}
      <section className="mt-10 space-y-3">
        <h2 className="font-medium">More Cursor Demos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={()=> guideCursorTo('usernameInput', { action: 'click' })}>Focus Username</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={()=> guideCursorTo('addr1', { action: 'click' })}>Focus Address 1</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={()=> guideCursorTo('stateSelect', { action: 'click' })}>Open State Select</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={()=> guideCursorTo('fileInput', { action: 'click' })}>Click File Upload</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={demoSortByScore}>Sort Table by Score</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={()=> guideCursorTo('tabSettings', { action: 'click' })}>Switch to Settings tab</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={demoOpenModalAndConfirm}>Open Modal then Confirm</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={demoSwitchToStatsAndStartProgress}>Go to Stats and Start</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={demoExpandAccordion2}>Expand Accordion 2</button>
          <button className="rounded-md border px-3 py-2 hover:bg-neutral-100" onClick={demoMoveFirstCardToDoing}>Move first card to Doing</button>
        </div>
      </section>
    </main>
  );
}
