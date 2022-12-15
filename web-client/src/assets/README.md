# About

The [`index.ts`](index.ts) source defines where to find the resources.  This helper comes in handy to keep the Vite paths sane, mostly due to the Phaser and other tooling not being Vite aware.

The actual assets themselves that live in this structure are the "source" for them.  That is, they must be processed and put into the [public](../../public/) folder in order to be used.
