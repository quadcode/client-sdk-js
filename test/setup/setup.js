import {config} from 'dotenv';

config({path: './.env.test'});

const {use} = await import("chai");
use((await import("chai-as-promised")).default);
