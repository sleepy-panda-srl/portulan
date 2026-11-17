// C#/Python spans retain complete declarations and feed the runner's range contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { outlineFile, languageOf, main, render } from "./symbols.mjs";
import { parseLineRange } from "../packs/tools/local-llm/runner/local-llm.mjs";
const flat = list => list.flatMap(e => [e, ...flat(e.children)]);
const cs = [
    'namespace Acme;',
    '#region Models',
    '[Serializable]',
    'public class Box<T> where T : new()',
    '{',
    '    public int Size { get; private set; } = 3;',
    '    public string Label => "{ fake }";',
    '    public Box() : this(new int[] { 1, 2 }) { }',
    '    private Box(int[] values) { Size = values.Length; }',
    '    public (int a, int b) Pair() => (1, 2);',
    '    public T Make<U>() where U : class { return new T(); }',
    '    public static bool operator <(Box<T> a, Box<T> b) => false;',
    '    public static bool operator >(Box<T> a, Box<T> b) => false;',
    '    public static implicit operator int(Box<T> a) => a.Size;',
    '    public int this[int i] => i;',
    '    public event Action Changed;',
    '    private Func<int> getSize = () => { return 2; };',
    '    private object data = new Thing { Value = new[] { 1, 2 } };',
    '    public class Nested { public void Run() { } }',
    '    public enum State { Ready, Busy = 2 }',
    '    public delegate void Done(int value);',
    '    ~Box() { }',
    '    void IDisposable.Dispose() { }',
    '}',
    '#endregion',
    'public record Item(string Name);',
].join('\n');
test("C# outlines namespaces, types and complete direct members", () => {
    const outline = outlineFile("fixture.cs", "fixture.cs", cs), all = flat(outline.entries);
    for (const name of ["Acme", "Box", "Size", "Label", "Pair", "Make", "operator <", "operator >", "operator int", "this", "Changed", "getSize", "data", "Nested", "Run", "State", "Ready", "Busy", "Done", "~Box", "Dispose", "Item"]) {
        assert.ok(all.some(e => (Array.isArray(e.name) ? e.name : [e.name]).includes(name)), `missing ${name}`);
    }
    assert.deepEqual(all.filter(e => e.name === "Box").map(e => [e.start, e.end]), [[3, 24], [8, 8], [9, 9]]);
    assert.equal(all.find(e => e.name === "data").end, 18);
    assert.equal(all.find(e => e.name === "Size").end, 6);
    assert.equal(all.find(e => e.name === "Run").start, 19);
    for (const e of all) assert.deepEqual(parseLineRange(`${e.start}-${e.end}`, outline.lines), { start: e.start, end: e.end });
    assert.match(render("fixture.cs", outline).join('\n'), /6-6 .*Size/);
});
test("C# literals and comments cannot invent declarations or braces", () => {
    const text = ['class A {', ' string x = @"class Fake { ""quote"" }";', ' string y = """', 'class Fake {', '""";', ' string z = $"value {Call("}")}";', ' string q = $$"""{{Call("}")}}""";', " char c = '}';", ' /* class Fake { } */', ' public void Real() {}', '}'].join('\n');
    assert.deepEqual(flat(outlineFile("a.cs", "a.cs", text).entries).map(e => e.name), ["A", "x", "y", "z", "q", "c", "Real"]);
});
test("C# shared field declarations retain aliases, initializer bodies and same-line siblings", () => {
    const src='class A { public Dictionary<string, int> a = new() { ["x"] = 1 }, b = new(); public int c, d; public int E { get; } = Make(() => { return 1; }); }';
    const all=flat(outlineFile('a.cs','a.cs',src).entries);
    assert.deepEqual(all.map(e=>e.name),['A',['a','b'],['c','d'],'E']);
    assert.equal(src.slice(all[1].startOffset,all[1].endOffset),'public Dictionary<string, int> a = new() { ["x"] = 1 }, b = new();');
    assert.equal(src.slice(all[3].startOffset,all[3].endOffset),'public int E { get; } = Make(() => { return 1; });');
});
test("C# block namespaces, attribute spans and CRLF declarations", () => {
    const src='namespace A.B {\r\n [Mark(1)]\r\n public struct C {\r\n public int F;\r\n }\r\n}';
    const all=flat(outlineFile('a.cs','a.cs',src).entries);
    assert.deepEqual(all.map(e=>[e.name,e.start,e.end]),[['A.B',1,6],['C',2,5],['F',4,4]]);
    const range=parseLineRange(`${all[1].start}-${all[1].end}`,6);
    assert.equal(src.split('\n').slice(range.start-1,range.end).join('\n'),' [Mark(1)]\r\n public struct C {\r\n public int F;\r\n }\r');
});
test("C# comparison operators cannot consume the following member", () => {
    for(const op of ['==','!=','<=','>=']) {
        const src=`class A {\n public static bool operator ${op}(A a, A b) { return true; }\n public int F;\n}`;
        assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries).map(e=>[e.name,e.start,e.end]),[['A',1,4],[`operator ${op}`,2,2],['F',3,3]]);
    }
});
test("C# tuple delegates and generic method groups preserve names without comparison aliases", () => {
    assert.deepEqual(flat(outlineFile('a.cs','a.cs','public delegate (int A,int B) D<T>(T x) where T:new();').entries).map(e=>e.name),['D']);
    for(const src of ['class C { public Func<int, int> f = Format<int, int>, g = Format<int, int>; }','class C { public bool a = x < y, b = z > (w), c = true; }']) {
        assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries).at(-1).name,src.includes('Format')?['f','g']:['a','b','c']);
    }
    assert.deepEqual(flat(outlineFile('a.cs','a.cs','global using System; class A {}').entries).map(e=>e.name),['A']);
});
test("conditional generic method groups and function-pointer fields retain every alias", () => {
    const cases=[
        ['class C { public Func<int,int> f = flag ? (Func<int,int>)Format<int,int> : Format<int,int>, g = null; }',['f','g']],
        ['unsafe class C { public delegate*<int,void> first, second; public int F; }',['first','second']],
        ['unsafe class C { public delegate*<int,void> first = &Fn, second = &Fn; }',['first','second']],
    ];
    for(const [src,names] of cases) assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries)[1].name,names);
});
test("nested raw C# interpolation masks its inner delimiters", () => {
    const src='class A {\n string S = $$"""{{M("""}""")}}""";\n void F() { }\n}';
    assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries).map(e=>[e.name,e.start,e.end]),[['A',1,4],['S',2,2],['F',3,3]]);
});
test("verbatim quote runs stay verbatim, and extern methods are retained", () => {
    for(const literal of ['@""""','@"""hello"""','$@"""{value}"""','@$"""{value}"""']) {
        const src=`class C {\n string S = ${literal};\n extern public static void M();\n int F;\n}`;
        assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries).map(e=>[e.name,e.start,e.end]),[['C',1,5],['S',2,2],['M',3,3],['F',4,4]]);
    }
});
test("C# import directives are distinct from top-level executable using statements", () => {
    const imports='extern alias Library; global using System; using static System.Math; using Alias = System.String; using unsafe Pointer = int*; class C {}';
    assert.deepEqual(flat(outlineFile('a.cs','a.cs',imports).entries).map(e=>e.name),['C']);
    for(const using of ['using var handle = Open();','using (var handle = Open()) {}']) assert.throws(()=>outlineFile('a.cs','a.cs',`${using}\nclass C {}`),/unsupported C# declaration/);
});
test("C# escaped declarations expose semantic names consistently", () => {
    const src='namespace @event { class @class { enum @enum { @ready } void @return() {} } }';
    assert.deepEqual(flat(outlineFile('a.cs','a.cs',src).entries).map(e=>e.name),['event','class','enum','ready','return']);
});
const py = [
    '@decorate(',
    '    "def fake():",',
    ')',
    'class Box:',
    '    """class Fake:',
    '    def fake(): pass',
    '    """',
    '    @staticmethod',
    '    async def run(',
    '        value: tuple[int, int],',
    '    ):',
    '        text = f"value {str(\'}\')}"',
    '        if value:',
    '            def nested():',
    '                return value',
    '        return text',
    '',
    'if True:',
    '    def separate(): return 1',
    'def last():',
    '    """only a docstring"""',
].join('\n');
test("Python decorators, logical lines, docstrings and intervening suites have exact spans", () => {
    const outline = outlineFile("a.py", "a.py", py), all = flat(outline.entries);
    assert.deepEqual(all.map(e => [e.name, e.start, e.end]), [["Box",1,16],["run",8,16],["nested",14,15],["separate",19,19],["last",20,21]]);
    assert.equal(outline.entries[0].children.length, 1);
    assert.equal(outline.entries[1].name, "separate");
    for (const e of all) {
        const range = parseLineRange(`${e.start}-${e.end}`, outline.lines);
        const slice = py.split('\n').slice(range.start-1, range.end).join('\n');
        assert.ok(slice.includes(e.name)); assert.ok(slice.length > 0);
    }
    assert.equal(py.split('\n').slice(all[1].start-1, all[1].end).join('\n'), py.split('\n').slice(7,16).join('\n'));
});
test("Python tabs, continuation, CRLF and EOF spans", () => {
    const src = 'class A:\r\n\tdef one(self):\r\n\t\tvalue = \\\r\n\t\t\t1\r\n\t\treturn value\r\ndef two(): pass';
    assert.deepEqual(flat(outlineFile("a.py", "a.py", src).entries).map(e => [e.name,e.start,e.end]), [["A",1,5],["one",2,5],["two",6,6]]);
});
test("Python prefixes, escaped/triple delimiters, nested f-strings and docstring-only definitions", () => {
    const src=["def first():", "    r'''raw \\\' quote'''", "def second():", '    text = f"{dict(x=\'}\')[\'x\']}"', '    return "class Fake:"', 'class Last: """only docs"""'].join('\n');
    assert.deepEqual(flat(outlineFile('a.py','a.py',src).entries).map(e=>[e.name,e.start,e.end]),[['first',1,2],['second',3,5],['Last',6,6]]);
    assert.throws(()=>outlineFile('a.py','a.py','class A:\n\tdef f(): pass\n        def g(): pass'),/ambiguous tabs\/spaces/);
});
test("Python return-annotation colons keep the suite, and independent suites may use different indentation", () => {
    for(const annotation of ['lambda: int','{"x": int}','lambda x: lambda y: y']) {
        const src=`def f() -> ${annotation}:\n    return 1\ndef g(): pass`;
        assert.deepEqual(flat(outlineFile('a.py','a.py',src).entries).map(e=>[e.name,e.start,e.end]),[['f',1,2],['g',3,3]]);
    }
    const src='def f():\n\tpass\ndef g():\n        pass';
    assert.deepEqual(flat(outlineFile('a.py','a.py',src).entries).map(e=>[e.name,e.start,e.end]),[['f',1,2],['g',3,4]]);
});
test("a Python raw f-string backslash does not escape interpolation braces", () => {
    const src='def f():\n    return rf"\\{foo("}")}"\ndef g(): pass';
    assert.deepEqual(flat(outlineFile('a.py','a.py',src).entries).map(e=>[e.name,e.start,e.end]),[['f',1,2],['g',3,3]]);
});
test("Python format text quotes and nested replacement fields stay inside the literal", () => {
    for(const expression of ['f"{123:\'>10}"', 'f\'{123:"<10}\'', 'f"{123:{width}.{precision}f}"', 'f"{(lambda x: x)(123):\'>10}"']) {
        const src=`def f():\n    return ${expression}\ndef g(): pass`;
        assert.deepEqual(flat(outlineFile('a.py','a.py',src).entries).map(e=>[e.name,e.start,e.end]),[['f',1,2],['g',3,3]]);
    }
});
test("a Python UTF-8 BOM does not change declaration indentation", () => {
    assert.deepEqual(flat(outlineFile('a.py','a.py','\uFEFFdef f():\n    pass').entries).map(e=>[e.name,e.start,e.end]),[['f',1,2]]);
});
for (const [file, src] of [["a.cs", 'class A {'], ["a.cs", '#if DEBUG\nclass A {}\n#endif'], ["a.py", 'def f():\n    """unterminated'], ["a.py", 'def f(\n'], ["a.py", 'class A:\n    def f(): pass\n  def g(): pass']]) test(`malformed or conditional input refuses ${JSON.stringify(src)}`, () => {
    assert.throws(() => outlineFile(file,file,src), e => e.message.includes(file) && !/read it whole|read it as usual/.test(e.message));
});
test("language dispatch, unsupported guidance and tracked cross-language lookup", () => {
    assert.equal(languageOf("a.cs"), "cs"); assert.equal(languageOf("a.py"), "py"); assert.equal(languageOf("tool", "#!/usr/bin/env python3"), "py");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-code-outline-"));
    try {
        execFileSync("git",["init","-q"],{cwd:dir});
        fs.writeFileSync(path.join(dir,"a.cs"), 'class A { public void Run() {} public Func<int,int> a = Format<int,int>, b = null; public delegate (int X,int Y) D(); }');
        fs.writeFileSync(path.join(dir,"b.py"), 'class B:\n    def run(self): pass\n');
        fs.writeFileSync(path.join(dir,"untracked.py"), 'def run(): pass\n');
        execFileSync("git",["add","a.cs","b.py"],{cwd:dir});
        let out='',err=''; const io = {write:s=>out+=s}, errors={write:s=>err+=s};
        assert.equal(main(['node','symbols','--find','A.Run','B.run'],io,errors,dir),0,err);
        assert.match(out,/a.cs:1-1 .*Run/); assert.match(out,/b.py:2-2 .*run/); assert.doesNotMatch(out,/untracked/);
        out=''; err=''; assert.equal(main(['node','symbols','--find','A.b','A.D'],io,errors,dir),0,err); assert.match(out,/a.cs:1-1/);
        out=''; err=''; assert.equal(main(['node','symbols','--find','A.int'],io,errors,dir),1); assert.equal(out,'');
        fs.writeFileSync(path.join(dir,"notes.txt"),'content'); out=''; err='';
        assert.equal(main(['node','symbols','notes.txt'],io,errors,dir),2); assert.match(err,/declaration search/); assert.doesNotMatch(err,/read it whole/);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
