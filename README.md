# About
This is babel plugin that moves automatically locally scoped styled components to outside of the current component scope, e.g.:

## Disclaimer: this is experimental, use at your own risk

**from**:
```jsx
function MyReactComponent(props) {
    const StyledButton = styled.div`
        background: ${props.color};
        ${props.disabled && css`
            pointer-events: none;
        `};
    `;

    return <StyledButton />;
}

class AnotherComponent extends Component {
    render() {
        const { destructuredPropWorksToo } = this.props;
        const StyledLabel = styled.label`
            font-weight: ${this.props.bold ? 600 : 400};
            text-align: ${destructuredPropWorksToo === "primary" ? "center" : "left"};
        `;
        return <StyledLabel />
    }
}
```

**to**:
```jsx
const StyledButton = styled.div`
    background: ${p => p.color};
    ${p => p.disabled && css`
        pointer-events: none;
    `};
`;
function MyReactComponent(props) {
    return <StyledButton color={props.color} disabled={props.disabled} />
}

const StyledLabel = styled.label`
    font-weight: ${p => p.bold ? 600 : 400};
    text-align: ${p => p.destructuredPropWorksToo === "primary" ? "center" : "left"};
`;

class AnotherComponent extends Component {
    render() {
        const { destructuredPropWorksToo } = this.props;
        return <StyledLabel bold={this.props.bold} destructuredPropWorksToo={destructuredPropWorksToo} />
    }
}
```

Notice auto-added attributes and interpolations for ```StyledButton``` and ```StyledLabel```


### Why?
Many components have "private" styled components, locally scoped to this component. If these components contain dynamic styling and when using typescript/flow you usually need to type props for all such components. Tedious task:

```tsx
interface CompA {
    active: boolean;
}
// Locally scoped component
const CompA = styled.button<CompA>`
    background: ${props => props.active ? "green" : "blue"};
`;

interface CompB {
    width: number;
}
// Locally scoped component
const CompB = styled.div<CompB>`
    width: ${props => props.width}px;
`;

// etc...

export interface SomeItemProps {
    active: boolean;
    small: boolean;
}

export function SomeItem(props: SomeItemProps) {
    return (
        <CompB width={props.small ? 100 : 200}>
            <CompA active={props.active} />
        </CompB>
    );
}

```

With this transformer enabled you can write instead:

```tsx
export interface SomeItemProps {
    active: boolean;
    small: boolean;
}

export function SomeItem(props: SomeItemProps) {
    const CompA = styled.button`
        background: ${props.active ? "green" : "blue"};
    `;
    const CompB = styled.div`
        width: ${props.small ? 100 : 200}px;
    `;
    return (
        <CompB>
            <CompA />
        </CompB>
    );
}
```
and don't fear about creating new styled components on every render

## Installation/Configuration

1.
```yarn add styled-components-auto-scoping --dev```

or with npm:

```npm install styled-components-auto-scoping --save-dev```

2.
Add to your babel config

```js
plugins: [
    "styled-components-auto-scoping"
]
```

There are 2 configuration options you can pass to transformer:
```js
plugins: [
    ["styled-components-auto-scoping", {
        // List of identifiers to process
        styledIdentifiers: ["styled"],
        // add attribute prefix to the generated jsx attributes, empty string leaves attributes untact
        addAttributePrefix: "",
    }]
]
```

3.
Use