import Modifier from 'ember-modifier';
import {isEmpty} from '@ember/utils';

const errorClass = 'error';
const successClass = 'success';

export default class ValidationStatusModifier extends Modifier {
    modify(element, positional, {errors, property, hasValidated}) {
        const validationClass = this.errorClass(errors, property, hasValidated);

        element.classList.remove(errorClass);
        element.classList.remove(successClass);

        if (validationClass) {
            element.classList.add(validationClass);
        }
    }

    errorClass(errors, property, hasValidated) {
        const hasError = this.hasError(errors, property, hasValidated);

        if (hasValidated && hasValidated.includes(property)) {
            return hasError ? errorClass : successClass;
        } else {
            return '';
        }
    }

    hasError(errors, property, hasValidated) {
        // if we aren't looking at a specific property we always want an error class
        if (!property && errors && !errors.get('isEmpty')) {
            return true;
        }

        // If we haven't yet validated this field, there is no validation class needed
        if (!hasValidated || !hasValidated.includes(property)) {
            return false;
        }

        if (errors && !isEmpty(errors.errorsFor(property))) {
            return true;
        }

        return false;
    }
}
