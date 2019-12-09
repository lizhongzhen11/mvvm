/**
 * @description 模拟 vue 实现一个Mvvm demo库
 * 
 * 借鉴于：
 * 1. https://github.com/DMQ/mvvm
 * 2. https://juejin.im/post/5abdd6f6f265da23793c4458
 * 3. https://github.com/codeyu/mini-mvvm
 * 
 * 需要实现的功能点：
 * 1. 数据监听
 * 2. 数据改变，驱动视图渲染变化
 * 3. 模板编译
 * 
 * 技能点：
 * 1. 利用es6的 proxy 进行数据拦截监听
 * 2. createDocumentFragment：https://developer.mozilla.org/zh-CN/docs/Web/API/Document/createDocumentFragment
 * 3. appendChild：https://developer.mozilla.org/zh-CN/docs/Web/API/Node/appendChild
 * 4. cloneNode：https://developer.mozilla.org/zh-CN/docs/Web/API/Node/cloneNode ， 新规范有所更改，不传deep默认不拷贝后代元素
 * 5. Node.nodeType：https://developer.mozilla.org/zh-CN/docs/Web/API/Node/nodeType
 * 6. RegExp.$1-$9：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/RegExp/n
 * 
 * 
 * 注意点：
 * 1. proxy代理数组对象时，set必须返回 true，不然使用数组api会报错
 *    见：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/set
 * 2. 模板中变量用 {{}} 来包裹，正则也只判断 {{}} 中的变量并渲染
 */


// 开始第一版，第一版大致看了下人家的思想，以及一些我实在想不通的地方，大部分是自己的实现代码
// 最后对比下，差距很大，我虽然实现了最简单的渲染和更新功能，但是在数据监听里面去调compiler很不好
// 而且，compiler只考虑了{{a}}没考虑{{a.b}}这种情况，因为正则匹配到，去data里面取会变成data['a.b']
// 观察
class Observe1 {
  constructor (target, mvvm) {
    this.target = target;
    return this.proxy();
  }
  // proxy 拦截赋值，取值操作
  proxy () {
    return new Proxy(this.target, {
      get (target, propKey, receiver) {
        console.log('get...', target, propKey, receiver)
        return target[propKey];
      },
      set (target, propKey, value, receiver) {
        console.log('set...', target, propKey, value, receiver)
        if (target[propKey] === value) {
          return true;
        }
        target[propKey] = value;
        observe(value);

        // 自己实现的，更新再去调编译，虽然功能确实实现了，但是这样很不好！！！
        new Compiler1(mvvm.el, mvvm);

        // 必须返回true，否则数组api调用报错
        return true;
      }
    })
  }
}

// 主要为了避免不是对象却造成Observe实例化浪费
const observe1 = (obj) => {
  // 不是对象或者null等情况直接返回，不能观察
  if (!obj || typeof obj !== 'object') {
    return
  }
  return new Observe1(obj);
}

// 编译
class Compiler1 {
  constructor (el, mvvm) {
    this.mvvm = mvvm;
    // 在el范围里将内容都拿到，当然不能一个一个的拿
    // 选择利用文档片段，文档片段的内容会交由内存处理，对其进行dom操作不会影响dom树，减少重绘，节省开销
    let fragment = document.createDocumentFragment();
    let child;
    // 将原生节点拷贝到fragment
    // 这里一开始没看懂，我没用过 createDocumentFragment
    // 实践证明，如果没有 fragment.appendChild(child)，将会无限循环
    // fragment.appendChild(child) 这段代码更像从 dom 中将 this.mvvm.$el.firstChild 不断抽走
    // 事实证明在 while  循环后再度打印 this.mvvm.$el.firstChild时返回 null.
    // 我真是个彩笔，这是因为 appendChild：
    // 如果被插入的节点已经存在于当前文档的文档树中,则那个节点会首先从原先的位置移除,然后再插入到新的位置.

    // 实际上这里已经导致页面重绘了，因为页面上原来的节点不在了
    // 有一种办法优化，就是利用 cloneNode 先复制副本，然后操作副本的节点，最后再替换dom中的节点
    // 自己写出来才发现，狗屁的优化啊。。。
    // 最终还是得再度遍历去删除节点，然后替换
    // 还不如第一次直接用appendChild把原子节点清掉，然后直接一次性appendChild添加多省事！！！

    this.mvvm.$el = document.querySelector(el); // 根据el拿到dom节点
    while (child = this.mvvm.$el.firstChild) {
      // console.log(child === this.mvvm.$el.firstChild, child, this.mvvm.$el.firstChild);
      fragment.appendChild(child);
    }
    // console.log(this.mvvm.$el.firstChild) // null

    // 使用 cloneNode 优化，在最后需要替换时再一次性替换节点
    // this.mvvm.$el = document.querySelector(el).cloneNode(true);
    // while (child = this.mvvm.$el.firstChild) {
    //   fragment.appendChild(child);
    // }

    const reg = /\{\{(.*?)\}\}/g; // 匹配 {{}} 正则
    const recursion = (fragment) => {
      Array.from(fragment.childNodes).forEach(node => {
        // console.log(node, node.nodeType, node.textContent)
        let content = node.textContent;
        let nodeType = node.nodeType;
        if (nodeType === 1 && reg.test(content)) {

          // 这是为什么？？？我真不懂
          // 还是MDN牛逼，不过非标准规范，写写demo也没事
          console.log(RegExp.$1) // 需要替换的变量，就是下面的 variable

          // console.log('textContent', content);
          let len = content.length;
          let variable = content.substring(2, len - 2);
          console.log('编译获取到的变量', variable, this.mvvm.data[variable])
          node.textContent = this.mvvm.data[variable];
          node.observeKey = variable;
          return;
        }
        // 更新
        if (node.observeKey) {
          node.textContent = this.mvvm.data[node.observeKey];
        }
      })
    }
    recursion(fragment);

    // 这里 SB 了
    // 由于用了cloneNode，虽然编译找变量值在内存中操作，并且没有动节点，
    // 但是最终要替换时还得再次遍历下原来的节点去把子节点都删掉，然后替换
    // 真多此一举！！！
    // let parentNode = document.querySelector(el);
    // while(child = parentNode.firstChild) {
    //   parentNode.removeChild(child);
    // }
    // parentNode.appendChild(fragment);

    this.mvvm.$el.appendChild(fragment);
  }
}

/**
 * @description 类似 Vue
 * 传入的数据格式如下：
 * {
 *   el: '#id', // id 换成自己定义的
 *   data: {
 *     key: value // key, value 也是自己定义的
 *   }
 * }
 */
class Mvvm1 {
  constructor (mvvm = {}) {
    this.mvvm = mvvm;
    this.data = this.mvvm.data;
    this.mvvm.data = observe(this.data);
    if (!this.mvvm.el) {
      throw '请传入dom节点';
    }
    new Compiler1(this.mvvm.el, this.mvvm);
    return this.mvvm;
  }
}




// 第二版，借鉴于人家文章+自己理解猜想，记录了自己的困难点

let nodes = []; // 缓存所有需要编译的dom节点

// 主要为了避免不是对象却造成Observe实例化浪费
const observe2 = (obj) => {
  // 不是对象或者null等情况直接返回，不能观察
  if (!obj || typeof obj !== 'object') {
    return
  }
  return new Observe2(obj);
}

// 数据监听
class Observe2 {
  constructor (data) {
    this.data = data;
    return this.proxy();
  }
  proxy () {
    return new Proxy(this.data, {
      get (target, key) {
        return target[key];
      },
      set (target, key, value) {
        if (target[key] === value) {
          return;
        }
        target[key] = value;

        observe2(value); // 如果value是对象，需要继续监听

        nodes.forEach(item => {
          let keys = item.key.split('.')
          if (keys.length === 1) {
            item.node.textContent = value
          }
        })

        return true;
      }
    })
  }
}

const replace = (dom, data) => {
  let reg = /\{\{(.*?)\}\}/;
  Array.from(dom.childNodes).forEach(node => {
    if (node.nodeType === 1 && reg.test(node.textContent)) {
      nodes.push({
        key: node.textContent,
        node: node
      });
      let keys = RegExp.$1.split('.'); // 可能是 a.b.c 这种情况
      let val = data[keys[0]]; // 缓存查到的 data[key] 值
      let txt = node.textContent;
      console.log(val, '...........')
      for (let i = 1; i < keys.length; i++) {
        val = val[keys[i]];
      }

      // 这里我陷入了困境
      // 因为在第一次渲染时，我已经将dom中需要编译的变量给替换掉了，
      // 一旦变量值更新，我如何再次替换到dom中呢？？？
      // 网上文章用到了发布订阅模式，我不看他们代码，自己能否将发布订阅模式与此相连接起来呢？？？
      // 我真的迷茫了。。。
      // 我猜测是在变量更新时通知页面渲染更新，
      // 可是我始终无法解决dom中变量初次渲染后，数据更新后如何确定页面那个地方需要更新？
      // 因为我已经把 node.textContent 替换掉了啊
      // 除非我初次渲染时将每个需要编译的变量缓存起来
      // 定义一个全局数组变量，缓存它们？
      // 每次更新时从数组中深拷贝个副本出来，替换？？？
      // 然后我就实践了下，我日日日日日，真TM成功了！！！
      node.textContent = txt.replace(reg, val).trim();
    }
    // 如果还有子节点，继续递归replace
    if (node.childNodes && node.childNodes.length) {
      replace(node, data);
    }
  })
}

// 编译
class Compiler2 {
  constructor (mvvm, id) {
    this.mvvm = mvvm;
    this.mvvm.$el = document.querySelector(id);
    this.render();
  }
  render () {
    let child;
    let fragment = document.createDocumentFragment();
    while (child = this.mvvm.$el.firstChild) {
      fragment.appendChild(child);
    }

    replace(fragment, this.mvvm.data);
    this.mvvm.$el.appendChild(fragment);
  }
}

class Mvvm2 {
  constructor (mvvm) {
    this.mvvm = mvvm;
    this.mvvm.data = observe2(this.mvvm.data);
    new Compiler2(this.mvvm, this.mvvm.el);
    return this.mvvm;
  }
}






// 第三版，用发布订阅模式来替代全局数组对象

// 先把发布订阅模式写好，我这里完全自己写的，先自己猜想着去实现，最后再去对比
class Dep1 {
  constructor () {
    this.subs = [];
  }
  add ({type, node, fn}) {
    !this.subs.some(sub => sub.type === type) && this.subs.push({type, node, fn}); // 防止重复添加
  }
  notify (type, value) {
    this.subs.forEach(sub => {
      if (!type) {
        sub.fn(sub.node);
      }
      if (type === sub.type) { // 例如sub.type为 a.b.c
        sub.fn(sub.node, value);
      }
    })
  }
}

class Observe3 {
  constructor (data, dep, type) {
    this.data = data;
    this.dep = dep;
    this.type = type;
    return this.proxy();
  }
  proxy () {
    let dep = this.dep;
    let type = this.type;
    return new Proxy(this.data, {
      get (target, key) {
        return target[key];
      },
      set (target, key, value) {
        if (target[key] === value) {
          return true;
        }
        target[key] = value;
        observe3(value, dep, type);
        if (type && type.lastIndexOf(key) === type.length - key.length) {
          dep.notify(type, value);
        }
        dep.notify(key, value);
        return true;
      }
    })
  }
}

const observe3 = (data, dep, type) => {
  if (typeof data !== 'object' || data == null) {
    return;
  }
  return new Observe3(data, dep, type);
}

class Compiler3 {
  constructor (mvvm, dep) {
    this.mvvm = mvvm;
    this.mvvm.data = mvvm.data;
    this.mvvm.$el = document.querySelector(this.mvvm.el);
    this.dep = dep;
    this.render();
  }
  render () {
    let fragment = document.createDocumentFragment();
    let child;
    while (child = this.mvvm.$el.firstChild) {
      fragment.appendChild(child);
    }
    this.replcae(fragment);
    this.mvvm.$el.appendChild(fragment);
  }
  replcae (dom) {
    let reg = /\{\{(.*?)\}\}/;
    Array.from(dom.childNodes).forEach(node => {
      if (node.nodeType === 1 && reg.test(node.textContent)) {
        let key = RegExp.$1;
        // 添加订阅
        this.dep.add({type: key, node: node, fn: (node, val) => node.textContent = val })
        let keys = key.split('.'); // a.b.c => ['a', 'b', 'c']


        /***************************************************** */
        // 如果是嵌套对象，那么需要递归下对内部所有子孙对象进行监听
        // 下面这段代码写的不是很好，靠着控制台打印不断试错才写出来的
        // 好多坑啊，比如我这里递归监听赋值，导致调用了set并去更新了视图，实际上这里我不需要更新视图啊
        // 关键点在于，我对 a.b 和 a.e.f 都传递了相同的key，那么当下面改变a.f.e值时，此时key可能是a.b，
        // 会造成 a.b 对应的视图值渲染成 a.e.f 的值。。。
        // 需要阻止这里的视图更新
        // 我在 set 里面进行了判断，终于算是解决
        const ob = (data) => {
          if (typeof data !== 'object' || !data || Array.isArray(data)) {
            return data;
          }
          let ks = Object.keys(data);
          ks.forEach(k => {
            data[k] = ob(data[k]);
          })
          return observe3(data, this.dep, key) || data;
        }
        let val = this.mvvm.data[keys[0]] = ob(this.mvvm.data[keys[0]]);
        /**************************************************** */


        for (let i = 1; i < keys.length; i++) {
          val = val[keys[i]];
        }
        node.textContent = val;
      }
    })
  }
}

class Mvvm3 {
  constructor (mvvm) {
    this.dep = new Dep1();
    this.mvvm = mvvm;
    this.mvvm.data = observe3(this.mvvm.data, this.dep);
    new Compiler3(this.mvvm, this.dep);
    return this.mvvm;
  }
}





/**
 * @description 附上以上文章的源码，他们跟vue一样，采用Dep和Watch两个联合构建发布订阅
 * 我理解的好处在于：
 * 1. 需要更新时，直接通过Dep.target对应的this就能对相应的node进行更新
 *    不需要像我这样，弄个 type， 根据 type 去比对更新。
 *    我需要根据 type 去获取该更新谁，所以我不得不在 Compiler 的 replace 里面去拿到type，然后不断传递
 * 2. 事实上，真正的库，例如 vue，我们是可以在 template 中多处使用同一个变量的，但是我这里不行，没有实现
 * 3. 还有个最最最重要的好处，我写的实在太low逼，需要递归，判断，但是人家通过Dep.target直接限制死了，操，真的好！！！
 * 4. 我双向绑定和计算属性还没有实现。
 * 
 * 以上主要是我自己的代码实践，毕竟直接看总会误以为自己懂了，实际上，我什么都不懂。
 * 如果真的靠看看就懂了，我TM早就上清华了。
 */