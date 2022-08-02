import fs from "fs";
import { marked } from "marked";

const sections = [];
const posts = [];

for (const file of fs.readdirSync("./content")) {
  if (!/\.md$/.test(file)) continue;
  const data = fs.readFileSync("./content/" + file, { encoding: "utf-8" });
  const title = data.substring(0, data.indexOf("\n")).replace(/^[\s#]*|\s*$/g, "");
  let slug = file.replace(/\.md$/, "");
  const html = marked.parse(data);
  const match = /^(\d{4})\-(\d{2})_/.exec(file);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const time = new Date(year, month - 1);
    slug = slug.substring(8);
    posts.push({ title, slug, html, year, month, time });
  } else {
    sections.push({ title, slug, html });
  }
}

posts.sort((a, b) => b.time - a.time);

const BEGIN_HEADLINES = "<!-- BEGIN HEADLINES -->";
const END_HEADLINES = "<!-- END HEADLINES -->";
const BEGIN_POSTS = "<!-- BEGIN POSTS -->";
const END_POSTS = "<!-- END POSTS -->";

const index = fs.readFileSync("./index.html", { encoding: "utf-8" });
let out =  index.substring(0, index.indexOf(BEGIN_HEADLINES) + BEGIN_HEADLINES.length);
out += "\n";
for (const post of posts) {
  out += `    <li><a href="#${post.slug}">${post.title}</a></li>\n`;
}
out += index.substring(index.indexOf(END_HEADLINES), index.indexOf(BEGIN_POSTS) + BEGIN_POSTS.length);
out += "\n";
for (const post of sections.concat(posts)) {
  out += `<div id="${post.slug}" class="view">\n${post.html.trimEnd()}\n</div>\n`;
}
out += index.substring(index.indexOf(END_POSTS));
fs.writeFileSync("./index.html", out);
