import {Entity} from '../../common/entity';

type SnippetData = {
    readonly name: string;
    lexical: string;
    mobiledoc: string;
};

export class Snippet extends Entity<SnippetData> implements SnippetData {
    get name() {
        return this.attr.name;
    }

    get lexical() {
        return this.attr.lexical;
    }

    set lexical(value) {
        this.set('lexical', value);
    }

    get mobiledoc() {
        return this.attr.mobiledoc;
    }

    set mobiledoc(value) {
        this.set('mobiledoc', value);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static create(data: any) {
        return new Snippet(data);
    }
}