// Bounded lexical C#/Python outlines; source offsets keep line spans honest.
export class CannotOutline extends Error {}
const word = v => /^[@\p{L}_][\p{L}\p{N}_@]*$/u.test(v);
const modifiers = new Set('public private protected internal static abstract virtual override sealed async partial new unsafe extern readonly volatile required ref scoped file'.split(' '));
function source(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
    const line = at => {
        let lo = 0, hi = starts.length;
        while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= at) lo = mid; else hi = mid; }
        return lo + 1;
    };
    return { starts, line, lines: src.length ? starts.length - Number(src.endsWith('\n')) : 0 };
}
function tokensOf(src, language, index) {
    const t = [], pairs = new Map(), stack = [];
    const fail = (why, at) => { throw new CannotOutline(`${why} on line ${index.line(at)}`); };
    const literal = at => {
        const match = (language === 'cs' ? /^(\$+@?|@\$?)?("|')/ : /^([rRuUbBfFtT]{0,2})("|')/).exec(src.slice(at));
        if (!match) return null;
        const prefix = match[1] ?? '', quote = match[2], begin = at + prefix.length;
        let count = 1;
        while (src[begin + count] === quote) count++;
        const rawCs = language === 'cs' && !prefix.includes('@') && quote === '"' && count >= 3;
        const width = rawCs ? count : language === 'py' && count >= 3 ? 3 : 1;
        const endMark = quote.repeat(width), verbatim = language === 'cs' && prefix.includes('@');
        const interpolated = /[$fFtT]/.test(prefix);
        let p = begin + width;
        while (p < src.length) {
            if (src.startsWith(endMark, p)) {
                if (verbatim && src[p + 1] === quote) { p += 2; continue; }
                return p + width;
            }
            if (!rawCs && !verbatim && src[p] === '\\') { p += language==='py' && interpolated && '{}'.includes(src[p+1]) ? 1 : 2; continue; }
            if (width === 1 && !verbatim && /[\r\n]/.test(src[p])) fail('unterminated literal', at);
            if (interpolated && src[p] === '{') {
                if (!rawCs && src[p + 1] === '{') { p += 2; continue; }
                const braces=rawCs?(prefix.match(/\$/g)?.length??0):1;
                if(rawCs && !src.startsWith('{'.repeat(braces),p)) { p++; continue; }
                p = interpolation(p + braces); continue;
            }
            p++;
        }
        fail('unterminated literal', at);
    };
    const interpolation = at => {
        const groups=[];
        let format=false, p = at;
        while (p < src.length) {
            if(format) {
                if(src[p]==='{') { p=interpolation(p+1); continue; }
                if(src[p]==='}') return p+1;
                p++; continue;
            }
            if (language === 'cs' && src.startsWith('/*',p)) { const end=src.indexOf('*/',p+2); if(end<0) fail('unterminated interpolation comment',p); p=end+2; continue; }
            if (language === 'cs' && src.startsWith('//',p) || language === 'py' && src[p]==='#') { const end=src.indexOf('\n',p); if(end<0) break; p=end+1; continue; }
            const quoted = literal(p);
            if (quoted !== null) { p = quoted; continue; }
            if(src[p]===':' && groups.length===0) format=true;
            if('([{'.includes(src[p])) groups.push(src[p]);
            if(')]}'.includes(src[p])) {
                if(src[p]==='}' && groups.length===0) return p+1;
                if('([{'.indexOf(groups.pop())!==')]}'.indexOf(src[p])) fail('unmatched interpolation bracket',p);
            }
            p++;
        }
        fail('unterminated interpolation', at);
    };
    for (let i = 0; i < src.length;) {
        if (/\s/.test(src[i])) { i++; continue; }
        if (language === 'py' && src[i] === '#' || language === 'cs' && src.startsWith('//', i)) {
            const end = src.indexOf('\n', i); i = end < 0 ? src.length : end; continue;
        }
        if (language === 'cs' && src.startsWith('/*', i)) {
            const end = src.indexOf('*/', i + 2); if (end < 0) fail('unterminated comment', i); i = end + 2; continue;
        }
        if (language === 'cs' && src[i] === '#' && /^\s*$/.test(src.slice(index.starts[index.line(i)-1], i))) {
            const end = src.indexOf('\n', i), directive = src.slice(i, end < 0 ? src.length : end);
            if (/^#\s*(if|elif|else|endif)\b/.test(directive)) fail('conditional compilation needs a preprocessed source view; use a declaration search on the original', i);
            i = end < 0 ? src.length : end; continue;
        }
        const quoted = literal(i);
        let end, value;
        if (quoted !== null) { end = quoted; value = '<literal>'; }
        else {
            const name = (language === 'cs' ? /^[@\p{L}_][\p{L}\p{N}_@]*/u : /^[\p{L}_][\p{L}\p{N}_]*/u).exec(src.slice(i));
            value = name?.[0] ?? (/^(=>|==|!=|<=|>=)/.exec(src.slice(i))?.[0] ?? src[i]); end = i + value.length;
            if (language === 'py' && value === '\\' && /^\r?\n/.test(src.slice(end))) end += src[end] === '\r' ? 2 : 1;
        }
        const at = t.length;
        t.push({ v: value, start: i, end, line: index.line(i), endLine: index.line(end-1), depth: stack.length });
        if ('([{'.includes(value)) stack.push(at);
        if (')]}'.includes(value)) {
            const open = stack.pop();
            if (open === undefined || '([{'.indexOf(t[open].v) !== ')]}'.indexOf(value)) fail('unmatched bracket', i);
            pairs.set(open, at); pairs.set(at, open);
        }
        i = end;
    }
    if (stack.length) fail('unclosed bracket', t[stack.at(-1)].start);
    return { t, pairs };
}
function entry(src, index, first, last, name, children = [], labelEnd = first.end) {
    return { start: first.line, end: last.endLine, startOffset: first.start, endOffset: last.end, range: true, name,
        text: src.slice(first.start, labelEnd).trim().replace(/\s+/g, ' ').slice(0, 110), children };
}
export function outlineCs(src) {
    const index = source(src), { t, pairs } = tokensOf(src, 'cs', index);
    const nameOf = list => {
        const op = list.findIndex(x => x.v === 'operator');
        if (op >= 0) return `operator ${list.slice(op+1,list.findIndex((x,i)=>i>op&&x.v==='(')).map(x => x.v).join('')}`;
        for (let i = 0; i < list.length; i++) if (list[i].v === '(') {
            let p = i-1;
            if (list[p]?.v === '>') {
                let depth = 1; p--;
                while (p >= 0 && depth) { if (list[p].v === '>') depth++; if (list[p].v === '<') depth--; p--; }
            }
            if (word(list[p]?.v ?? '') && !modifiers.has(list[p].v) && list[p].v!=='delegate') return (list[p-1]?.v === '~' ? '~' : '') + list[p].v.replace(/^@/, '');
            const close = pairs.get(t.indexOf(list[i]));
            while (i+1 < list.length && list[i+1].start <= t[close].start) i++;
        }
        if (list.some(x => x.v === 'this')) return 'this';
        return list.filter(x => word(x.v) && !modifiers.has(x.v)).at(-1)?.v.replace(/^@/, '');
    };
    const walk = (lo, hi, scope = 'root') => {
        const entries = [];
        for (let p = lo; p < hi;) {
            if (t[p].v === ';') { p++; continue; }
            const first = p;
            while (t[p]?.v === '[') p = pairs.get(p)+1;
            const head = p;
            let cursor = p, boundary = null;
            while (cursor < hi) {
                const v = t[cursor].v;
                if (['{',';','=>','='].includes(v)) { boundary = v; break; }
                if (v === '(' || v === '[') cursor = pairs.get(cursor)+1;
                else cursor++;
            }
            if (boundary === null) throw new CannotOutline(`unbounded C# declaration on line ${t[first].line}; use a declaration search`);
            const header = t.slice(head,cursor), values = header.map(x=>x.v);
            const namespace = values[0] === 'namespace';
            const type = values.findIndex((v,i) => ['class','struct','interface','record','enum'].includes(v) && values.slice(0,i).every(x=>modifiers.has(x)));
            const typeName = type >= 0 ? header[type+1+(values[type] === 'record' && ['class','struct'].includes(values[type+1]) ? 1 : 0)]?.v.replace(/^@/,'') : null;
            const usingAt=values[0]==='global'?1:0, alias=values.slice(usingAt+1).filter(v=>v!=='unsafe');
            const skip = values[0]==='extern' && values[1]==='alias' || values[usingAt]==='using' && (boundary===';' && !values.includes('(') || boundary==='=' && alias.length===1 && word(alias[0]));
            let end = cursor, children = [];
            if (boundary === '{') {
                end = pairs.get(cursor);
                if (namespace || type >= 0) children = values[type] === 'enum' ? enumMembers(cursor+1,end) : walk(cursor+1,end,type >= 0 ? 'type' : 'root');
                let next = end+1;
                if (t[next]?.v === '=') { while (next < hi && t[next].v !== ';') next = pairs.has(next) && '([{'.includes(t[next].v) ? pairs.get(next)+1 : next+1; end = next; }
                else if (t[next]?.v === ';') end = next;
            } else if (boundary === '=' || boundary === '=>') {
                while (end < hi && t[end].v !== ';') end = pairs.has(end) && '([{'.includes(t[end].v) ? pairs.get(end)+1 : end+1;
            }
            if (end >= hi) throw new CannotOutline(`missing declaration terminator on line ${t[first].line}`);
            if (namespace && boundary === ';') {
                entries.push(entry(src,index,t[first],t[hi-1],values.slice(1).map(v=>v.replace(/^@/,'')).join(''),walk(end+1,hi),t[cursor].start));
                return entries;
            }
            let name = namespace ? values.slice(1).map(v=>v.replace(/^@/,'')).join('') : typeName ?? nameOf(header);
            if (!namespace && type < 0 && ['=',';'].includes(boundary) && !(values.includes('delegate') && values[values.indexOf('delegate')+1]!=='*')) {
                const names = []; let begin=head, angle=0, initialized=false;
                for(let k=head;k<=end;k++) {
                    const v=t[k].v;
                    if(pairs.has(k)&&'([{'.includes(v)) { k=pairs.get(k); continue; }
                    if(v==='=') initialized=true;
                    if(v==='<') {
                        let next=k+1, depth=1;
                        while(next<end && depth && ![';','='].includes(t[next].v)) { if(t[next].v==='<') depth++; if(t[next].v==='>') depth--; next++; }
                        if(!initialized || depth===0) angle++;
                    }
                    if(v==='>' && angle) angle--;
                    if(v===';' || v===',' && !angle) {
                        const piece=t.slice(begin,k), equal=piece.findIndex(x=>x.v==='=');
                        names.push(nameOf(equal<0?piece:piece.slice(0,equal))); begin=k+1; initialized=false;
                    }
                }
                if(names.length>1) name=names;
            }
            if (!skip) {
                if (!name || scope === 'root' && !namespace && type < 0 && !values.includes('delegate')) throw new CannotOutline(`unsupported C# declaration on line ${t[first].line}; use a declaration search`);
                entries.push(entry(src,index,t[first],t[end],name,children,t[cursor].start));
            }
            p = end+1;
        }
        return entries;
    };
    const enumMembers = (lo,hi) => {
        const out=[];
        for(let p=lo;p<hi;) {
            const first=p; while(t[p]?.v==='[') p=pairs.get(p)+1;
            const name=t[p]?.v; let end=p;
            while(end<hi && t[end].v!==',') end=pairs.has(end)&&'([{'.includes(t[end].v)?pairs.get(end)+1:end+1;
            if(!word(name??'')) throw new CannotOutline(`unsupported enum member on line ${t[first].line}`);
            out.push(entry(src,index,t[first],t[Math.max(first,end-1)],name.replace(/^@/,''),[],t[Math.max(first,end-1)].end)); p=end+1;
        }
        return out;
    };
    return { lines:index.lines, entries:walk(0,t.length) };
}
export function outlinePy(src) {
    const index=source(src), {t,pairs}=tokensOf(src,'py',index), statements=[];
    for(let p=0;p<t.length;) {
        const first=p; let end=p;
        while(end+1<t.length) {
            if(pairs.has(end)&&'([{'.includes(t[end].v)) end=pairs.get(end);
            if(end+1>=t.length || t[end+1].line>t[end].endLine && t[end].v!=='\\') break;
            end++;
        }
        let whitespace=src.slice(index.starts[t[first].line-1],t[first].start);
        if(t[first].line===1) whitespace=whitespace.replace(/^\uFEFF/,'');
        if(!/^[ \t\f]*$/.test(whitespace)) throw new CannotOutline(`unsupported logical line on line ${t[first].line}`);
        let indent=0;
        for(const c of whitespace) indent=c==='\t'?indent+8-indent%8:c==='\f'?0:indent+1;
        statements.push({first,last:end,indent,whitespace}); p=end+1;
    }
    const levels=[0], spellings=new Map([[0,'']]);
    for(let i=0;i<statements.length;i++) {
        const s=statements[i], previous=statements[i-1];
        if(spellings.has(s.indent) && spellings.get(s.indent)!==s.whitespace && /\t/.test(spellings.get(s.indent)+s.whitespace)) throw new CannotOutline(`ambiguous tabs/spaces on line ${t[s.first].line}`);
        spellings.set(s.indent,s.whitespace);
        if(s.indent>levels.at(-1)) {
            if(!previous || t[previous.last].v!==':') throw new CannotOutline(`unexpected indentation on line ${t[s.first].line}`);
            levels.push(s.indent);
        } else {
            while(s.indent<levels.at(-1)) spellings.delete(levels.pop());
            if(s.indent!==levels.at(-1)) throw new CannotOutline(`inconsistent indentation on line ${t[s.first].line}`);
        }
    }
    const entries=[], owners=[];
    let decorators=null;
    for(let i=0;i<statements.length;i++) {
        const s=statements[i], first=t[s.first];
        if(first.v==='@') { if(!decorators || decorators.indent!==s.indent) decorators={first:s.first,indent:s.indent}; continue; }
        let at=s.first;
        if(t[at].v==='async') at++;
        if(!['class','def'].includes(t[at]?.v)) { decorators=null; continue; }
        const kind=t[at].v, name=t[at+1]?.v;
        if(!word(name??'')) throw new CannotOutline(`unnamed Python definition on line ${first.line}`);
        let colon=at+2, lambdas=0;
        while(colon<=s.last) {
            if(pairs.has(colon)&&'([{'.includes(t[colon].v)) { colon=pairs.get(colon)+1; continue; }
            if(t[colon].v==='lambda') lambdas++;
            if(t[colon].v===':') { if(!lambdas) break; lambdas--; }
            colon++;
        }
        if(colon>s.last) throw new CannotOutline(`missing definition colon on line ${first.line}`);
        let last=s.last;
        if(colon===s.last) {
            let next=i+1;
            while(next<statements.length && statements[next].indent>s.indent) { last=statements[next].last; next++; }
            if(last===s.last) throw new CannotOutline(`empty Python suite on line ${first.line}`);
        }
        const begin=decorators?.indent===s.indent?decorators.first:s.first;
        const e=entry(src,index,t[begin],t[last],name,[],t[colon].end);
        while(owners.length && owners.at(-1).endOffset<=e.startOffset) owners.pop();
        (owners.at(-1)?.children??entries).push(e); owners.push(e); decorators=null;
    }
    return {lines:index.lines,entries};
}
