import plugin from "../index";
import { transform } from "@babel/core";

it("Moves styled component to outer scope", () => {
    const src = `
function Test1() {
    const A1 = styled.div\`
        color: #fff;
    \`;

    const A2 = styled(A1)\`
        color: #000;
    \`;

    const A3 = styled("div")\`
        color: #fff;
    \`;
}

const Test2 = () => {
    const A4 = styled.div\`
        color: #fff;
    \`;

    const A5 = styled(A4)\`
        color: #000;
    \`;

    const A6 = styled("div")\`
        color: #fff;
    \`;
}

class Test3 extends Component {
    render() {
        const A7 = styled.div\`\`;
        const A8 = styled(Test2)\`\`;
    }
}
    `;

    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin] })!.code).toMatchSnapshot();
});

it("Does not transform top level styled components", () => {
    const src = `
const A = styled.div\`\`;
const B = styled.div\`
    \${props => props.a};
\`;

const C = styled(A)\`\`;
const D = styled(Comp)\`
    \${someProp};
\`;
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin] })!.code).toMatchSnapshot();
});

it("Process local identifiers in styled templates", () => {
    const src = `
import { themeProp } from "theme";
const someVar = 5;

function Test1(props) {
    const { localProp } = props;
    const A = styled.div\`
        color: green;
        color: \${props};
        color: \${localProp};
        color: \${someVar};
        color: \${themeProp};
        color: \${nonExisted};
        background: \${localProp};
    \`;

    return (
        <div>
            <A prop="test"/>
            <A>test</A>
        </div>
    );
}

class Test2 extends Component {
    render() {
        const { clProp } = this.props;
        const B = styled.div\`
            color: green;
            color: \${clProp};
            color: \${someVar};
            color: \${themeProp};
            color: \${nonExisted};
            background: \${clProp};
        \`;

        return (
            <div>
                <B/>
                <B>test</B>
            </div>
        )
    }
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin], presets: ["@babel/react"] })!.code).toMatchSnapshot();
});

it("Process local member access in styled templates", () => {
    const src = `
import { theme } from "theme";
const someObj = { a: true };

function Test1(props) {
    const { localProp } = props;
    const A = styled.div\`
        color: \${props.a};
        color: \${props.b.c};
        color: \${localProp};
        color: \${localProp.e};
        color: \${theme.a};
        color: \${someObj.a};
        background: \${props.a};
        background: \${localProp.e};
    \`;

    return (
        <div>
            <A prop="test"/>
            <A>test</A>
        </div>
    );
}

class Test2 extends Component {
    render() {
        const { clProp } = this.props;
        const B = styled.div\`
            color: \${clProp.a};
            color: \${clProp.a.b};
            color: \${this.props};
            color: \${this.props.c};
            color: \${theme.a};
            color: \${someObj.a};
            background: \${clProp.a};
            background: \${clProp.d};
            background: \${this.props.c};
            background: \${this.props.k};
        \`;

        return (
            <div>
                <B/>
                <B>test</B>
            </div>
        )
    }
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin], presets: ["@babel/react"] })!.code).toMatchSnapshot();

});

it("Process logical expressions in styled templates", () => {
    const src = `
import { theme } from "theme";

function Test1(props) {
    const { localProp } = props;
    const A = styled.div\`
        color: \${props.a && "green"};
        color: \${localProp.b && props.a1};
        color: \${localProp.c ? props.x : props.y};
        color: \${localProp.c && localProp.k ? props.e : props.t.t ? props.m.m : "test"};
        color: \${props.a && theme.a};
        color: \${props.a ? theme.a : theme.b};
    \`;

    return (
        <A />
    );
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin], presets: ["@babel/react"] })!.code).toMatchSnapshot();
});

it("Process arrow function expressions in styled templates", () => {
    const src = `
import { theme } from "theme";
const someObj = { a: true };

function Test1(props) {
    const { localProp, anotherProp, xyz } = props;
    const A = styled.div\`
        color: \${props => props.a && localProp};
        color: \${props => props.a && localProp ? anotherProp : "Test" };
        color: \${differentName => differentName.a && xyz};
    \`;

    return (
        <A a={props.a} />
    );
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin], presets: ["@babel/react"] })!.code).toMatchSnapshot();
});

it("Adds attribute name prefix when specified", () => {
    const src = `

function Test1(props) {
    const { localProp } = props;
    const A = styled.div\`
        color: \${localProp};
        color: \${props.b};
    \`;

    return (
        <A prop="test"/>
    );
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [[plugin, { addAttributePrefix: "ui_" }]], presets: ["@babel/react"] })!.code).toMatchSnapshot();
});

it("Works for negative logical expressions", () => {
    const src = `
import { theme } from "theme";

function Test1(props) {
    const { localProp } = props;
    const A = styled.div\`
        color: \${!props.a && "green"};
        color: \${!localProp.b && props.a1};
        color: \${!localProp.c ? props.x : props.y};
        color: \${!localProp.c && localProp.k ? props.e : props.t.t ? props.m.m : "test"};
        color: \${!props.a && theme.a};
        color: \${!props.a ? theme.a : theme.b};
    \`;

    return (
        <A />
    );
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin], presets: ["@babel/react"] })!.code).toMatchSnapshot();
});

it("Works with styled.attrs", () => {
    const src = `
function Test1() {
    const A1 = styled.div.attrs({ className: "test" })\`
        color: #fff;
    \`;
    const A2 = styled(A1).attrs({ className: "test2" })\`
        color: #fff;
    \`;
}
    `;
    expect(transform(src, { babelrc: false, configFile: false, plugins: [plugin] })!.code).toMatchSnapshot();
});